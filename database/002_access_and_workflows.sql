-- Run after 001_schema.sql with the same dedicated migration owner.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ktc_app') THEN CREATE ROLE ktc_app NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='ktc_worker') THEN CREATE ROLE ktc_worker NOLOGIN; END IF;
END $$;
GRANT USAGE ON SCHEMA ktc TO ktc_app,ktc_worker;

-- Express verifies the session, then sets this transaction-local value.
-- It is an application trust boundary, not a credential for direct end-user SQL.
CREATE FUNCTION ktc.actor_id() RETURNS uuid LANGUAGE sql STABLE
SET search_path=pg_catalog,ktc AS $$ SELECT nullif(current_setting('app.user_id',true),'')::uuid $$;

CREATE FUNCTION ktc.role_in_project(pid uuid) RETURNS ktc.project_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
  SELECT m.role FROM ktc.project_user m JOIN ktc.app_user u USING(user_id)
  WHERE m.project_id=pid AND m.user_id=ktc.actor_id() AND m.is_active AND u.is_active
$$;
CREATE FUNCTION ktc.can_see_user(uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
  SELECT EXISTS (SELECT 1 FROM ktc.app_user me WHERE me.user_id=ktc.actor_id() AND me.is_active)
  AND (uid=ktc.actor_id() OR EXISTS (
    SELECT 1 FROM ktc.project_user mine JOIN ktc.project_user theirs USING(project_id)
    WHERE mine.user_id=ktc.actor_id() AND mine.is_active AND theirs.user_id=uid))
$$;

-- Serializes a write with archive/revocation, so an in-flight write cannot
-- commit after its membership has already been revoked by another transaction.
CREATE FUNCTION ktc.write_role(pid uuid) RETURNS ktc.project_role
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE r ktc.project_role; archived timestamptz;
BEGIN
  SELECT archived_at INTO archived FROM ktc.project WHERE project_id=pid FOR SHARE;
  IF NOT FOUND OR archived IS NOT NULL THEN RAISE EXCEPTION 'Project is unavailable or archived' USING ERRCODE='42501'; END IF;
  SELECT m.role INTO r FROM ktc.project_user m JOIN ktc.app_user u USING(user_id)
    WHERE m.project_id=pid AND m.user_id=ktc.actor_id() AND m.is_active AND u.is_active FOR SHARE OF m,u;
  IF r IS NULL THEN RAISE EXCEPTION 'Active project membership required' USING ERRCODE='42501'; END IF;
  RETURN r;
END $$;

CREATE FUNCTION ktc.create_project(project_name varchar, project_description text DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE pid uuid;
BEGIN
  PERFORM 1 FROM ktc.app_user WHERE user_id=ktc.actor_id() AND is_active AND can_create_projects FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project creation not permitted' USING ERRCODE='42501'; END IF;
  INSERT INTO ktc.project(name,description,created_by) VALUES(project_name,project_description,ktc.actor_id()) RETURNING project_id INTO pid;
  INSERT INTO ktc.project_user(project_id,user_id,role) VALUES(pid,ktc.actor_id(),'administrator');
  RETURN pid;
END $$;

CREATE FUNCTION ktc.set_project_member(pid uuid, uid uuid, member_role ktc.project_role, active boolean DEFAULT true) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
BEGIN
  -- Project lock serializes simultaneous last-administrator removals.
  PERFORM 1 FROM ktc.project WHERE project_id=pid FOR UPDATE;
  IF ktc.role_in_project(pid) IS DISTINCT FROM 'administrator' THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM ktc.app_user WHERE user_id=uid AND (is_active OR NOT active) FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Eligible account required' USING ERRCODE='23514'; END IF;
  IF NOT active AND EXISTS (SELECT 1 FROM ktc.punch_item WHERE project_id=pid AND assignee_user_id=uid) THEN
    RAISE EXCEPTION 'Reassign or clear assigned items before deactivating membership' USING ERRCODE='23514';
  END IF;
  IF EXISTS (SELECT 1 FROM ktc.project_user WHERE project_id=pid AND user_id=uid AND role='administrator' AND is_active)
     AND (NOT active OR member_role <> 'administrator')
     AND NOT EXISTS (SELECT 1 FROM ktc.project_user m JOIN ktc.app_user u USING(user_id)
       WHERE m.project_id=pid AND m.user_id<>uid AND m.role='administrator' AND m.is_active AND u.is_active) THEN
    RAISE EXCEPTION 'A project must retain an active administrator' USING ERRCODE='23514';
  END IF;
  INSERT INTO ktc.project_user(project_id,user_id,role,is_active) VALUES(pid,uid,member_role,active)
    ON CONFLICT(project_id,user_id) DO UPDATE SET role=EXCLUDED.role,is_active=EXCLUDED.is_active,updated_at=clock_timestamp();
END $$;

CREATE FUNCTION ktc.guard_account_deactivation() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,ktc AS $$
BEGIN
  IF NOT NEW.is_active AND OLD.is_active AND EXISTS(SELECT 1 FROM ktc.project_user WHERE user_id=OLD.user_id AND is_active) THEN
    RAISE EXCEPTION 'Deactivate project memberships before the account' USING ERRCODE='23514';
  END IF;
  NEW.updated_at := clock_timestamp(); RETURN NEW;
END $$;
CREATE TRIGGER account_guard BEFORE UPDATE ON ktc.app_user FOR EACH ROW EXECUTE FUNCTION ktc.guard_account_deactivation();

CREATE FUNCTION ktc.guard_punch_item() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE r ktc.project_role;
BEGIN
  r := ktc.write_role(NEW.project_id);
  IF TG_OP='INSERT' THEN
    IF r NOT IN ('administrator','inspector') THEN RAISE EXCEPTION 'Item creation not permitted' USING ERRCODE='42501'; END IF;
    NEW.created_by:=ktc.actor_id(); NEW.created_at:=clock_timestamp(); NEW.updated_at:=NEW.created_at; NEW.version:=1;
    IF NEW.status <> 'open' THEN RAISE EXCEPTION 'New items start open' USING ERRCODE='23514'; END IF;
  ELSE
    IF ROW(NEW.punch_item_id,NEW.project_id,NEW.drawing_id,NEW.page_number,NEW.x_ratio,NEW.y_ratio,NEW.created_by,NEW.created_at)
       IS DISTINCT FROM ROW(OLD.punch_item_id,OLD.project_id,OLD.drawing_id,OLD.page_number,OLD.x_ratio,OLD.y_ratio,OLD.created_by,OLD.created_at) THEN
      RAISE EXCEPTION 'Item identity, drawing anchor and authorship are immutable' USING ERRCODE='23514';
    END IF;
    IF r='contractor' THEN
      IF OLD.assignee_user_id IS DISTINCT FROM ktc.actor_id()
         OR ROW(NEW.title,NEW.description,NEW.assignee_user_id) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.assignee_user_id) THEN
        RAISE EXCEPTION 'Contractors may only change status of their assigned items' USING ERRCODE='42501';
      END IF;
    ELSIF r NOT IN ('administrator','inspector') THEN RAISE EXCEPTION 'Item editing not permitted' USING ERRCODE='42501'; END IF;
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT ((OLD.status='open' AND NEW.status='in_progress')
        OR (OLD.status='in_progress' AND NEW.status='ready_for_review')
        OR (r IN ('administrator','inspector') AND (
             (OLD.status='ready_for_review' AND NEW.status IN ('closed','in_progress'))
          OR (OLD.status='closed' AND NEW.status='open')))) THEN
        RAISE EXCEPTION 'Status transition not permitted' USING ERRCODE='23514';
      END IF;
    END IF;
    NEW.version:=OLD.version+1; NEW.updated_at:=clock_timestamp();
  END IF;
  IF NEW.assignee_user_id IS NOT NULL THEN
    PERFORM 1 FROM ktc.project_user m JOIN ktc.app_user u USING(user_id)
      WHERE m.project_id=NEW.project_id AND m.user_id=NEW.assignee_user_id AND m.is_active AND u.is_active FOR SHARE OF m,u;
    IF NOT FOUND THEN RAISE EXCEPTION 'Assignee must be an active project member' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER punch_guard BEFORE INSERT OR UPDATE ON ktc.punch_item FOR EACH ROW EXECUTE FUNCTION ktc.guard_punch_item();

CREATE FUNCTION ktc.record_item_event() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
BEGIN
  INSERT INTO ktc.punch_item_event(project_id,punch_item_id,actor_user_id,action,old_status,new_status,old_assignee,new_assignee,item_version)
  VALUES(NEW.project_id,NEW.punch_item_id,ktc.actor_id(),CASE WHEN TG_OP='INSERT' THEN 'created' ELSE 'updated' END,OLD.status,NEW.status,OLD.assignee_user_id,NEW.assignee_user_id,NEW.version);
  RETURN NEW;
END $$;
CREATE TRIGGER punch_history AFTER INSERT OR UPDATE ON ktc.punch_item FOR EACH ROW EXECUTE FUNCTION ktc.record_item_event();

CREATE FUNCTION ktc.can_add_evidence(pid uuid, item uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
 SELECT ktc.role_in_project(pid) IN ('administrator','inspector') OR
   (ktc.role_in_project(pid)='contractor' AND EXISTS (SELECT 1 FROM ktc.punch_item WHERE project_id=pid AND punch_item_id=item AND assignee_user_id=ktc.actor_id()))
$$;

CREATE FUNCTION ktc.stamp_write() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,ktc AS $$
DECLARE r ktc.project_role;
BEGIN
  IF TG_TABLE_NAME='project' THEN
    r:=ktc.role_in_project(NEW.project_id);
  ELSE
    r:=ktc.write_role(NEW.project_id);
  END IF;
  IF TG_TABLE_NAME IN ('drawing','drawing_page','project') THEN
    IF r IS DISTINCT FROM 'administrator' THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
  ELSIF TG_TABLE_NAME IN ('comment','photo','markup') THEN
    IF NOT COALESCE(ktc.can_add_evidence(NEW.project_id,NEW.punch_item_id),false) THEN RAISE EXCEPTION 'Evidence write not permitted' USING ERRCODE='42501'; END IF;
  END IF;
  IF TG_OP='INSERT' THEN
    IF TG_TABLE_NAME='drawing' OR TG_TABLE_NAME='photo' THEN NEW.uploaded_by:=ktc.actor_id(); END IF;
    IF TG_TABLE_NAME='comment' THEN NEW.author_user_id:=ktc.actor_id(); END IF;
    IF TG_TABLE_NAME='markup' THEN NEW.created_by:=ktc.actor_id(); END IF;
    IF TG_TABLE_NAME<>'drawing_page' THEN NEW.created_at:=clock_timestamp(); END IF;
  END IF;
  IF TG_TABLE_NAME IN ('project','comment','markup') THEN NEW.updated_at:=clock_timestamp(); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER project_stamp BEFORE UPDATE ON ktc.project FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();
CREATE TRIGGER drawing_stamp BEFORE INSERT ON ktc.drawing FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();
CREATE TRIGGER page_stamp BEFORE INSERT ON ktc.drawing_page FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();
CREATE TRIGGER comment_stamp BEFORE INSERT OR UPDATE ON ktc.comment FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();
CREATE TRIGGER photo_stamp BEFORE INSERT ON ktc.photo FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();
CREATE TRIGGER markup_stamp BEFORE INSERT OR UPDATE ON ktc.markup FOR EACH ROW EXECUTE FUNCTION ktc.stamp_write();

CREATE FUNCTION ktc.request_export(pid uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE eid uuid;
BEGIN
  -- Exports are also available for archived projects.
  IF COALESCE(ktc.role_in_project(pid) IN ('administrator','reviewer'),false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Export permission required' USING ERRCODE='42501'; END IF;
  INSERT INTO ktc.export_job(project_id,requested_by) VALUES(pid,ktc.actor_id()) RETURNING export_id INTO eid;
  RETURN eid;
END $$;

CREATE FUNCTION ktc.claim_export() RETURNS SETOF ktc.export_job
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE eid uuid;
BEGIN
  SELECT export_id INTO eid FROM ktc.export_job WHERE status='queued' ORDER BY created_at,export_id FOR UPDATE SKIP LOCKED LIMIT 1;
  IF eid IS NOT NULL THEN
    RETURN QUERY UPDATE ktc.export_job SET status='running',started_at=clock_timestamp() WHERE export_id=eid RETURNING *;
  END IF;
END $$;

CREATE FUNCTION ktc.finish_export(eid uuid, file_size bigint, checksum text, failure text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE job ktc.export_job; finished timestamptz:=clock_timestamp();
BEGIN
  SELECT * INTO job FROM ktc.export_job WHERE export_id=eid FOR UPDATE;
  IF NOT FOUND OR job.status<>'running' THEN RAISE EXCEPTION 'Only running exports can finish' USING ERRCODE='23514'; END IF;
  IF failure IS NOT NULL THEN
    UPDATE ktc.export_job SET status='failed',completed_at=finished,error_message=failure WHERE export_id=eid;
  ELSE
    UPDATE ktc.export_job SET status='succeeded',completed_at=finished,expires_at=finished+interval '7 days',
      storage_ref='projects/' || project_id::text || '/exports/' || export_id::text || '/package.zip',size_bytes=file_size,sha256=checksum
      WHERE export_id=eid;
  END IF;
END $$;

-- Flat project-scoped snapshot for a worker. It contains no authentication identifiers.
-- Call in a REPEATABLE READ transaction. Storage download and ZIP assembly are API worker responsibilities.
CREATE FUNCTION ktc.export_snapshot(pid uuid, requester uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE result jsonb;
BEGIN
  PERFORM 1 FROM ktc.project_user m JOIN ktc.app_user u USING(user_id)
    WHERE m.project_id=pid AND m.user_id=requester AND m.is_active AND u.is_active AND m.role IN ('administrator','reviewer') FOR SHARE OF m,u;
  IF NOT FOUND THEN RAISE EXCEPTION 'Export requester no longer authorized' USING ERRCODE='42501'; END IF;
  SELECT jsonb_build_object('schema_version',1,'exported_at',transaction_timestamp(),
    'project',(SELECT to_jsonb(p) FROM ktc.project p WHERE project_id=pid),
    'members',COALESCE((SELECT jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',u.display_name,'role',m.role,'is_active',m.is_active) ORDER BY m.user_id)
      FROM ktc.project_user m JOIN ktc.app_user u USING(user_id) WHERE m.project_id=pid),'[]'::jsonb),
    'drawings',COALESCE((SELECT jsonb_agg(to_jsonb(d) ORDER BY drawing_id) FROM ktc.drawing d WHERE project_id=pid),'[]'::jsonb),
    'pages',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY drawing_id,page_number) FROM ktc.drawing_page p WHERE project_id=pid),'[]'::jsonb),
    'items',COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY created_at,punch_item_id) FROM ktc.punch_item i WHERE project_id=pid),'[]'::jsonb),
    'comments',COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY created_at,comment_id) FROM ktc.comment c WHERE project_id=pid),'[]'::jsonb),
    'photos',COALESCE((SELECT jsonb_agg(to_jsonb(p) ORDER BY photo_id) FROM ktc.photo p WHERE project_id=pid),'[]'::jsonb),
    'markups',COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY markup_id) FROM ktc.markup m WHERE project_id=pid),'[]'::jsonb),
    'history',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY event_id) FROM ktc.punch_item_event e WHERE project_id=pid),'[]'::jsonb)
  ) INTO result;
  RETURN result;
END $$;

ALTER TABLE ktc.app_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY visible_users ON ktc.app_user FOR SELECT TO ktc_app USING(ktc.can_see_user(user_id));
ALTER TABLE ktc.project ENABLE ROW LEVEL SECURITY;
CREATE POLICY project_read ON ktc.project FOR SELECT TO ktc_app USING(ktc.role_in_project(project_id) IS NOT NULL);
CREATE POLICY project_edit ON ktc.project FOR UPDATE TO ktc_app USING(ktc.role_in_project(project_id)='administrator') WITH CHECK(ktc.role_in_project(project_id)='administrator');
ALTER TABLE ktc.project_user ENABLE ROW LEVEL SECURITY;
CREATE POLICY members_read ON ktc.project_user FOR SELECT TO ktc_app USING(ktc.role_in_project(project_id) IS NOT NULL);

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['drawing','drawing_page','punch_item','comment','photo','markup','export_job','punch_item_event'] LOOP
    EXECUTE format('ALTER TABLE ktc.%I ENABLE ROW LEVEL SECURITY',t);
    EXECUTE format('CREATE POLICY member_read ON ktc.%I FOR SELECT TO ktc_app USING (ktc.role_in_project(project_id) IS NOT NULL)',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['drawing','drawing_page'] LOOP
    EXECUTE format('CREATE POLICY admin_insert ON ktc.%I FOR INSERT TO ktc_app WITH CHECK (ktc.role_in_project(project_id)=''administrator'')',t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['comment','photo','markup'] LOOP
    EXECUTE format('CREATE POLICY evidence_insert ON ktc.%I FOR INSERT TO ktc_app WITH CHECK (ktc.can_add_evidence(project_id,punch_item_id))',t);
  END LOOP;
END $$;
CREATE POLICY item_insert ON ktc.punch_item FOR INSERT TO ktc_app WITH CHECK(ktc.role_in_project(project_id) IN ('administrator','inspector'));
CREATE POLICY item_edit ON ktc.punch_item FOR UPDATE TO ktc_app
  USING(ktc.role_in_project(project_id) IN ('administrator','inspector') OR (ktc.role_in_project(project_id)='contractor' AND assignee_user_id=ktc.actor_id()))
  WITH CHECK(ktc.role_in_project(project_id) IN ('administrator','inspector') OR (ktc.role_in_project(project_id)='contractor' AND assignee_user_id=ktc.actor_id()));
CREATE POLICY comment_edit ON ktc.comment FOR UPDATE TO ktc_app
  USING(ktc.role_in_project(project_id)='administrator' OR (author_user_id=ktc.actor_id() AND ktc.can_add_evidence(project_id,punch_item_id)))
  WITH CHECK(ktc.role_in_project(project_id)='administrator' OR (author_user_id=ktc.actor_id() AND ktc.can_add_evidence(project_id,punch_item_id)));
CREATE POLICY markup_edit ON ktc.markup FOR UPDATE TO ktc_app
  USING(ktc.role_in_project(project_id)='administrator' OR (created_by=ktc.actor_id() AND ktc.can_add_evidence(project_id,punch_item_id)))
  WITH CHECK(ktc.role_in_project(project_id)='administrator' OR (created_by=ktc.actor_id() AND ktc.can_add_evidence(project_id,punch_item_id)));

GRANT SELECT(user_id,display_name,email,is_active) ON ktc.app_user TO ktc_app;
GRANT SELECT ON ktc.project,ktc.project_user,ktc.drawing,ktc.drawing_page,ktc.punch_item,ktc.comment,ktc.photo,ktc.markup,ktc.export_job,ktc.punch_item_event TO ktc_app;
GRANT UPDATE(name,description,archived_at) ON ktc.project TO ktc_app;
GRANT INSERT ON ktc.drawing,ktc.drawing_page,ktc.punch_item,ktc.comment,ktc.photo,ktc.markup TO ktc_app;
GRANT UPDATE(title,description,status,assignee_user_id) ON ktc.punch_item TO ktc_app;
GRANT UPDATE(body) ON ktc.comment TO ktc_app;
GRANT UPDATE(markup_type,geometry_json) ON ktc.markup TO ktc_app;
-- No runtime DELETE, TRUNCATE, DDL, membership DML, account DML or history DML.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ktc FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ktc.actor_id(),ktc.role_in_project(uuid),ktc.can_see_user(uuid),ktc.write_role(uuid),ktc.can_add_evidence(uuid,uuid),ktc.valid_geometry(ktc.markup_kind,jsonb) TO ktc_app;
GRANT EXECUTE ON FUNCTION ktc.create_project(varchar,text),ktc.set_project_member(uuid,uuid,ktc.project_role,boolean),ktc.request_export(uuid) TO ktc_app;
GRANT EXECUTE ON FUNCTION ktc.claim_export(),ktc.finish_export(uuid,bigint,text,text),ktc.export_snapshot(uuid,uuid) TO ktc_worker;
ALTER DEFAULT PRIVILEGES IN SCHEMA ktc REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
INSERT INTO ktc.schema_migration(version,description) VALUES(2,'Runtime privileges, RLS, permissions, status workflow, export functions');
COMMIT;

-- Connect the existing Better Auth identities without replacing supplied SQL.
BEGIN;
ALTER TABLE ktc.punch_item ADD COLUMN priority varchar(6) NOT NULL DEFAULT 'MEDIUM'
  CHECK (priority IN ('LOW','MEDIUM','HIGH'));
GRANT UPDATE(priority) ON ktc.punch_item TO ktc_app;
CREATE FUNCTION ktc.guard_priority() RETURNS trigger LANGUAGE plpgsql
SET search_path=pg_catalog,ktc AS $$
BEGIN
  IF NEW.priority IS DISTINCT FROM OLD.priority
     AND ktc.role_in_project(NEW.project_id) NOT IN ('administrator','inspector') THEN
    RAISE EXCEPTION 'Priority editing not permitted' USING ERRCODE='42501';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER priority_guard BEFORE UPDATE ON ktc.punch_item
  FOR EACH ROW EXECUTE FUNCTION ktc.guard_priority();
CREATE FUNCTION ktc.ensure_auth_user(auth_id integer) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,ktc AS $$
DECLARE account public."User"; uid uuid;
BEGIN
  SELECT * INTO account FROM public."User" WHERE id=auth_id AND "emailVerified";
  IF NOT FOUND THEN RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
  INSERT INTO ktc.app_user(auth_issuer,auth_subject,display_name,email)
    VALUES('better-auth',auth_id::text,account.name,lower(account.email))
    ON CONFLICT(auth_issuer,auth_subject) DO UPDATE
      SET display_name=EXCLUDED.display_name,email=EXCLUDED.email,updated_at=clock_timestamp()
    RETURNING user_id INTO uid;
  IF NOT (SELECT is_active FROM ktc.app_user WHERE user_id=uid) THEN
    RAISE EXCEPTION 'Account is inactive' USING ERRCODE='42501';
  END IF;
  RETURN uid;
END $$;
REVOKE ALL ON FUNCTION ktc.ensure_auth_user(integer) FROM PUBLIC,ktc_app;
GRANT USAGE ON SCHEMA ktc TO ktc_auth;
GRANT EXECUTE ON FUNCTION ktc.ensure_auth_user(integer) TO ktc_auth;
INSERT INTO ktc.schema_migration(version,description)
VALUES(3,'Better Auth identity bridge and retained UI priority');
COMMIT;

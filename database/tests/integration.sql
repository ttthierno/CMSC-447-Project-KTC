\set ON_ERROR_STOP on
\pset pager off
BEGIN;
CREATE TEMP TABLE test_result(test_name text PRIMARY KEY);
GRANT INSERT,SELECT ON test_result TO ktc_app,ktc_worker;
CREATE FUNCTION pg_temp.assert_true(ok boolean, label text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL: %',label; END IF;
  INSERT INTO test_result VALUES(label);
END $$;
CREATE FUNCTION pg_temp.expect_error(statement text, expected_code text, label text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE rejected boolean:=false;
BEGIN
  BEGIN EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE <> expected_code THEN RAISE EXCEPTION 'FAIL: %: expected %, got %: %',label,expected_code,SQLSTATE,SQLERRM; END IF;
    rejected:=true;
  END;
  PERFORM pg_temp.assert_true(rejected,label);
END $$;

INSERT INTO ktc.app_user(user_id,auth_issuer,auth_subject,display_name,email,can_create_projects) VALUES
 ('10000000-0000-0000-0000-000000000001','test','admin','Test Admin','admin@example.invalid',true),
 ('10000000-0000-0000-0000-000000000002','test','inspector','Test Inspector','inspector@example.invalid',false),
 ('10000000-0000-0000-0000-000000000003','test','contractor','Test Contractor','contractor@example.invalid',false),
 ('10000000-0000-0000-0000-000000000004','test','reviewer','Test Reviewer','reviewer@example.invalid',false),
 ('10000000-0000-0000-0000-000000000005','test','outsider','Other Admin','other@example.invalid',true),
 ('10000000-0000-0000-0000-000000000006','test','inactive','Inactive Member',NULL,false),
 ('10000000-0000-0000-0000-000000000007','test','second_admin','Second Admin',NULL,false);
SELECT pg_temp.expect_error($s$INSERT INTO ktc.app_user(auth_issuer,auth_subject,display_name,email) VALUES('test','duplicate','Duplicate','ADMIN@example.invalid')$s$,'23505','Case insensitive email uniqueness');
INSERT INTO ktc.project(project_id,name,created_by) VALUES
 ('20000000-0000-0000-0000-000000000001','Test Project A','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','Test Project B','10000000-0000-0000-0000-000000000005');
INSERT INTO ktc.project_user(project_id,user_id,role,is_active) VALUES
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','administrator',true),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','inspector',true),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','contractor',true),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','reviewer',true),
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','contractor',false),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005','administrator',true);

SET LOCAL ROLE ktc_app;
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.project),'No identity sees no projects');
SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.project),'Project row security hides other projects');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.app_user WHERE user_id='10000000-0000-0000-0000-000000000005'),'Account directory hides unrelated users');
SELECT pg_temp.expect_error('SELECT auth_subject FROM ktc.app_user','42501','Runtime cannot read authentication identifiers');
SELECT pg_temp.assert_true(ktc.create_project('Created via function') IS NOT NULL,'Authorized project creation succeeds');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.project_user WHERE project_id=(SELECT project_id FROM ktc.project WHERE name='Created via function') AND role='administrator'),'Project creation atomically creates administrator');
SELECT pg_temp.expect_error($s$SELECT ktc.set_project_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','reviewer',true)$s$,'23514','Last administrator cannot be demoted');
SELECT ktc.set_project_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','administrator',true);
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM ktc.project_user WHERE project_id='20000000-0000-0000-0000-000000000001' AND role='administrator'),'Administrator can add project member');

INSERT INTO ktc.drawing(drawing_id,project_id,filename,storage_ref,size_bytes,sha256,page_count) VALUES
 ('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Test.pdf','projects/20000000-0000-0000-0000-000000000001/drawings/30000000-0000-0000-0000-000000000001/source.pdf',1000,repeat('a',64),2);
SELECT pg_temp.expect_error('SET CONSTRAINTS ALL IMMEDIATE','23514','Incomplete PDF metadata cannot commit');
INSERT INTO ktc.drawing_page(project_id,drawing_id,page_number,width_points,height_points) VALUES
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,612,792),
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',2,792,612);
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM ktc.drawing_page),'Complete multipage PDF accepted');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.drawing_page VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',3,612,792,0)$s$,'23514','Page beyond PDF page count rejected');
SELECT pg_temp.expect_error('UPDATE ktc.drawing SET page_count=1','42501','Uploaded PDF metadata is immutable');

SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000002',true);
SELECT pg_temp.expect_error($s$SELECT ktc.create_project('Unauthorized')$s$,'42501','Unprivileged account cannot create project');
SELECT pg_temp.expect_error($s$SELECT ktc.set_project_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','administrator')$s$,'42501','Inspector cannot promote self');
INSERT INTO ktc.punch_item(punch_item_id,project_id,drawing_id,page_number,x_ratio,y_ratio,title,description,assignee_user_id) VALUES
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,0.25,0.75,'Repair door','Adjust closer','10000000-0000-0000-0000-000000000003');
SELECT pg_temp.assert_true((SELECT created_by=ktc.actor_id() AND status='open' AND version=1 FROM ktc.punch_item WHERE punch_item_id='40000000-0000-0000-0000-000000000001'),'Item receives creator default status and version');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description) VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,1.1,0.5,'Bad','Bad')$s$,'23514','Coordinates outside zero to one rejected');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description) VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'NaN',0.5,'Bad','Bad')$s$,'23514','NaN coordinates rejected');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description) VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',3,0.5,0.5,'Bad','Bad')$s$,'23503','Item on nonexistent page rejected');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET assignee_user_id='10000000-0000-0000-0000-000000000005'$s$,'23514','Cross project assignee rejected');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET assignee_user_id='10000000-0000-0000-0000-000000000006'$s$,'23514','Inactive assignee rejected');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET status='closed'$s$,'23514','Skipped workflow transition rejected');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET x_ratio=0.4$s$,'42501','Drawing anchor cannot be overwritten');
SELECT pg_temp.expect_error('DELETE FROM ktc.punch_item','42501','Runtime cannot hard delete items');
SELECT pg_temp.expect_error('DELETE FROM ktc.punch_item_event','42501','Runtime cannot alter item history');
WITH changed AS (UPDATE ktc.punch_item SET title='Repair door closer' WHERE punch_item_id='40000000-0000-0000-0000-000000000001' AND version=1 RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM changed),'Optimistic update at current version succeeds');
WITH changed AS (UPDATE ktc.punch_item SET title='Stale' WHERE punch_item_id='40000000-0000-0000-0000-000000000001' AND version=1 RETURNING *)
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'Stale optimistic update changes no row');

INSERT INTO ktc.markup(project_id,drawing_id,page_number,markup_type,geometry_json) VALUES
 ('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'rectangle','{"schema_version":1,"points":[{"x":0.1,"y":0.1},{"x":0.5,"y":0.5}]}');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.markup WHERE punch_item_id IS NULL),'Drawing level markup accepted');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.markup(project_id,drawing_id,page_number,punch_item_id,markup_type,geometry_json) VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',2,'40000000-0000-0000-0000-000000000001','pin','{"schema_version":1,"points":[{"x":0.1,"y":0.1}]}')$s$,'23503','Item markup cannot target a different page');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.markup(project_id,drawing_id,page_number,markup_type,geometry_json) VALUES('20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',1,'pin','{"schema_version":1,"points":[{"x":null}]}')$s$,'23514','Malformed geometry rejected');
SELECT pg_temp.assert_true(NOT ktc.valid_geometry('text','{"schema_version":1,"points":[{"x":0.1,"y":0.2}],"text":""}'),'Empty text markup rejected');

SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000003',true);
UPDATE ktc.punch_item SET status='in_progress' WHERE punch_item_id='40000000-0000-0000-0000-000000000001';
UPDATE ktc.punch_item SET status='ready_for_review' WHERE punch_item_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT status='ready_for_review' FROM ktc.punch_item WHERE punch_item_id='40000000-0000-0000-0000-000000000001'),'Assigned contractor can submit for review');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET status='closed'$s$,'23514','Contractor cannot approve own work');
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET description='Changed'$s$,'42501','Contractor cannot edit issue description');
INSERT INTO ktc.comment(project_id,punch_item_id,body) VALUES('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Corrective work complete');
INSERT INTO ktc.photo(project_id,punch_item_id,photo_id,filename,storage_ref,content_type,size_bytes,sha256) VALUES
 ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001','door.jpg','projects/20000000-0000-0000-0000-000000000001/photos/50000000-0000-0000-0000-000000000001/original','image/jpeg',500,repeat('b',64));
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.comment) AND (SELECT count(*)=1 FROM ktc.photo),'Contractor can add evidence to assigned item');
SELECT pg_temp.expect_error($s$SELECT ktc.request_export('20000000-0000-0000-0000-000000000001')$s$,'42501','Contractor cannot request export');

SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000004',true);
WITH changed AS(UPDATE ktc.punch_item SET title='Unauthorized' RETURNING *) SELECT pg_temp.assert_true((SELECT count(*)=0 FROM changed),'Reviewer cannot edit items');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.comment(project_id,punch_item_id,body) VALUES('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Bad')$s$,'42501','Reviewer cannot add evidence');
SELECT pg_temp.assert_true(ktc.request_export('20000000-0000-0000-0000-000000000001') IS NOT NULL,'Reviewer can queue export');
SELECT pg_temp.expect_error('SELECT * FROM ktc.claim_export()','42501','Application cannot execute worker functions');

SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000005',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.punch_item),'Other project cannot see items');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.comment) AND (SELECT count(*)=0 FROM ktc.photo) AND (SELECT count(*)=0 FROM ktc.markup),'Other project cannot see supporting evidence');
SELECT pg_temp.expect_error($s$SELECT ktc.request_export('20000000-0000-0000-0000-000000000001')$s$,'42501','Cross project export rejected');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.punch_item(project_id,drawing_id,page_number,x_ratio,y_ratio,title,description) VALUES('20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001',1,0.1,0.1,'Bad','Wrong project')$s$,'23503','Cross project drawing reference rejected');
SELECT pg_temp.expect_error($s$INSERT INTO ktc.comment(project_id,punch_item_id,body) VALUES('20000000-0000-0000-0000-000000000002','40000000-0000-0000-0000-000000000001','Bad')$s$,'23503','Cross project comment reference rejected');

SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000001',true);
SELECT pg_temp.expect_error($s$SELECT ktc.set_project_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','contractor',false)$s$,'23514','Assigned membership cannot be deactivated');
UPDATE ktc.punch_item SET status='closed' WHERE punch_item_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT status='closed' AND x_ratio=0.25 AND y_ratio=0.75 FROM ktc.punch_item WHERE punch_item_id='40000000-0000-0000-0000-000000000001'),'Administrator can close item without moving marker');
SELECT pg_temp.assert_true((SELECT count(*)=5 FROM ktc.punch_item_event),'Successful changes have append only audit events');
UPDATE ktc.punch_item SET status='open' WHERE punch_item_id='40000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.punch_item WHERE status='open' AND assignee_user_id='10000000-0000-0000-0000-000000000003'),'Combined status and assignee filter is accurate');
UPDATE ktc.project SET archived_at=clock_timestamp() WHERE project_id='20000000-0000-0000-0000-000000000001';
SELECT pg_temp.expect_error($s$UPDATE ktc.punch_item SET title='Archived edit'$s$,'42501','Archived project rejects content writes');
SELECT ktc.set_project_member('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','administrator',false);
SELECT pg_temp.assert_true((SELECT NOT is_active FROM ktc.project_user WHERE user_id='10000000-0000-0000-0000-000000000007'),'Administrator can revoke membership on archived project');
UPDATE ktc.project SET archived_at=NULL WHERE project_id='20000000-0000-0000-0000-000000000001';
SELECT pg_temp.assert_true((SELECT archived_at IS NULL FROM ktc.project WHERE project_id='20000000-0000-0000-0000-000000000001'),'Administrator can restore archived project');

SET LOCAL ROLE ktc_worker;
SELECT pg_temp.expect_error('SELECT * FROM ktc.punch_item','42501','Worker has no unrestricted table access');
SELECT pg_temp.assert_true((SELECT count(*)=1 FROM ktc.claim_export()),'Worker atomically claims queued export');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.claim_export()),'Running export cannot be claimed twice');
SELECT pg_temp.assert_true(jsonb_array_length(ktc.export_snapshot('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004')->'items')=1,'Snapshot includes selected project items');
SELECT pg_temp.assert_true((ktc.export_snapshot('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000005')->'items')='[]'::jsonb,'Snapshot excludes unrelated project items');
SELECT pg_temp.assert_true(ktc.export_snapshot('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004')::text NOT LIKE '%auth_subject%','Export excludes authentication subject');
SELECT pg_temp.expect_error($s$SELECT ktc.export_snapshot('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005')$s$,'42501','Snapshot rechecks requester membership');
RESET ROLE;
SELECT export_id AS test_export_id FROM ktc.export_job WHERE project_id='20000000-0000-0000-0000-000000000001' \gset
SET LOCAL ROLE ktc_worker;
SELECT ktc.finish_export(:'test_export_id',2000,repeat('c',64));
SELECT pg_temp.expect_error(format('SELECT ktc.finish_export(%L,2000,repeat(''c'',64))',:'test_export_id'),'23514','Completed export cannot finish twice');
SET LOCAL ROLE ktc_app;
SELECT pg_temp.assert_true((SELECT status='succeeded' AND expires_at>completed_at FROM ktc.export_job WHERE export_id=:'test_export_id'),'Completed export has file metadata and expiry');
SELECT set_config('app.user_id','10000000-0000-0000-0000-000000000006',true);
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ktc.project),'Inactive membership loses project access');
RESET ROLE;
SET CONSTRAINTS ALL IMMEDIATE;
SELECT count(*) AS passed_checks FROM test_result;
SELECT test_name FROM test_result ORDER BY test_name;
ROLLBACK;

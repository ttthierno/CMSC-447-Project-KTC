-- Optional synthetic demonstration fixture. Apply as migration owner to a fresh database.
-- These IDs are reserved for this example. Real assets are in examples/sample_export/assets.
-- Upload those assets to the exact storage_ref keys before using an application file viewer.
BEGIN;
INSERT INTO ktc.app_user(user_id,auth_issuer,auth_subject,display_name,can_create_projects)
 VALUES('b0000000-0000-0000-0000-000000000001','example.invalid','demo-admin','Example Administrator',true);
INSERT INTO ktc.project(project_id,name,description,created_by)
 VALUES('a0000000-0000-0000-0000-000000000001','Example project','Synthetic demonstration data','b0000000-0000-0000-0000-000000000001');
INSERT INTO ktc.project_user(project_id,user_id,role) VALUES('a0000000-0000-0000-0000-000000000001','b0000000-0000-0000-0000-000000000001','administrator');
SET LOCAL ROLE ktc_app;
SELECT set_config('app.user_id','b0000000-0000-0000-0000-000000000001',true);
INSERT INTO ktc.drawing(drawing_id,project_id,filename,storage_ref,size_bytes,sha256,page_count)
 VALUES('c0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','sample-drawing.pdf','projects/a0000000-0000-0000-0000-000000000001/drawings/c0000000-0000-0000-0000-000000000001/source.pdf',1685,'b0290d901f209ef78b70459d2624e751a93e4806d0e3910acb5c09609f1a715e',1);
INSERT INTO ktc.drawing_page(project_id,drawing_id,page_number,width_points,height_points) VALUES('a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',1,612,792);
INSERT INTO ktc.punch_item(punch_item_id,project_id,drawing_id,page_number,x_ratio,y_ratio,title,description,assignee_user_id)
 VALUES('d0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',1,0.25,0.5,'Example door inspection','Verify the door closer in the sample workflow.','b0000000-0000-0000-0000-000000000001');
INSERT INTO ktc.comment(project_id,punch_item_id,body) VALUES('a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','Example comment for the portable export.');
INSERT INTO ktc.photo(photo_id,project_id,punch_item_id,filename,storage_ref,content_type,size_bytes,sha256,caption)
 VALUES('e0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-000000000001','placeholder.png','projects/a0000000-0000-0000-0000-000000000001/photos/e0000000-0000-0000-0000-000000000001/original','image/png',69,'e878950f8091ec010cf5cc723bdea027a8539cf7147cfea199c2f666232dcd4e','One-pixel image used only as a file-format fixture.');
INSERT INTO ktc.markup(markup_id,project_id,drawing_id,page_number,punch_item_id,markup_type,geometry_json)
 VALUES('f0000000-0000-0000-0000-000000000001','a0000000-0000-0000-0000-000000000001','c0000000-0000-0000-0000-000000000001',1,'d0000000-0000-0000-0000-000000000001','rectangle','{"schema_version": 1, "points": [{"x": 0.2, "y": 0.45}, {"x": 0.3, "y": 0.55}]}');
COMMIT;

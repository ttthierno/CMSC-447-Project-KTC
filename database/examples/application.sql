-- Execute using a LOGIN role that inherits ktc_app, not the migration owner.
-- The authenticated user UUID comes from the verified identity-provider session.
-- Bind $1 etc. through the driver; never concatenate request values into SQL.

BEGIN;
SELECT set_config('app.user_id', $1::text, true);
SELECT project_id,name,description FROM ktc.project ORDER BY name,project_id;
COMMIT;

-- Update with optimistic concurrency. Zero rows = stale version or inaccessible
-- item; API should return 409 for a known visible stale item, otherwise 404.
BEGIN;
SELECT set_config('app.user_id', $1::text, true);
UPDATE ktc.punch_item SET title=$2,description=$3
 WHERE project_id=$4::uuid AND punch_item_id=$5::uuid AND version=$6
 RETURNING *;
COMMIT;

-- Parameterized filters with deterministic pagination (cap LIMIT at 100 in API).
BEGIN;
SELECT set_config('app.user_id', $1::text, true);
SELECT * FROM ktc.punch_item
 WHERE project_id=$2::uuid
   AND ($3::ktc.punch_status IS NULL OR status=$3::ktc.punch_status)
   AND ($4::uuid IS NULL OR assignee_user_id=$4::uuid)
   AND ($5::uuid IS NULL OR drawing_id=$5::uuid)
   AND ($6::text IS NULL OR to_tsvector('english',title || ' ' || description) @@ websearch_to_tsquery('english',$6))
 ORDER BY created_at DESC,punch_item_id
 LIMIT $7 OFFSET $8;
COMMIT;

-- Worker uses its separate ktc_worker login. Commit the claim before doing I/O.
BEGIN;
SELECT * FROM ktc.claim_export();
COMMIT;
BEGIN ISOLATION LEVEL REPEATABLE READ;
SELECT ktc.export_snapshot($1::uuid,$2::uuid);
COMMIT;
-- Assemble ZIP from snapshot and immutable file keys, verify upload, then:
SELECT ktc.finish_export($1::uuid,$2::bigint,$3::text);
-- On failure use sanitized text, not stack traces or secrets:
SELECT ktc.finish_export($1::uuid,NULL,NULL,$2::text);

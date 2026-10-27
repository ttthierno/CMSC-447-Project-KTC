-- Read-only inventory for a staging restore of the original Prisma schema.
SELECT 'projects' AS kind,count(*) FROM public."Project"
UNION ALL SELECT 'drawings',count(*) FROM public."Drawing"
UNION ALL SELECT 'items',count(*) FROM public."PunchItem"
UNION ALL SELECT 'memberships',count(*) FROM public."ProjectMember"
UNION ALL SELECT 'comments',count(*) FROM public."PunchItemComment"
UNION ALL SELECT 'photos',count(*) FROM public."PunchItemPhoto";

SELECT id,"projectId","drawingId","pageNumber",
  CASE WHEN "drawingId" IS NULL THEN 'missing drawing'
       WHEN "pageNumber" IS NULL OR "pageNumber"<1 THEN 'missing/invalid page'
       WHEN "markerX" IS NULL OR "markerY" IS NULL THEN 'missing anchor'
       WHEN NOT ("markerX" BETWEEN 0 AND 1 AND "markerY" BETWEEN 0 AND 1) THEN 'invalid anchor'
       WHEN description IS NULL OR length(trim(description))=0 THEN 'missing description'
  END AS blocker
FROM public."PunchItem"
WHERE "drawingId" IS NULL OR "pageNumber" IS NULL OR "pageNumber"<1
   OR "markerX" IS NULL OR "markerY" IS NULL
   OR NOT ("markerX" BETWEEN 0 AND 1 AND "markerY" BETWEEN 0 AND 1)
   OR description IS NULL OR length(trim(description))=0;

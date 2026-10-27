ALTER TABLE "User"
ADD COLUMN "displayUsername" TEXT,
ADD COLUMN "username" TEXT;

UPDATE "User"
SET
  "username" = 'user_' || "id"::TEXT,
  "displayUsername" = "name";

ALTER TABLE "User"
ALTER COLUMN "username" SET NOT NULL;

CREATE UNIQUE INDEX "User_username_key"
ON "User"("username");
-- CreateTable
CREATE TABLE "PunchItemComment" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "punchItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchItemComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchItemPhoto" (
    "id" SERIAL NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "punchItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PunchItemPhoto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PunchItemComment" ADD CONSTRAINT "PunchItemComment_punchItemId_fkey" FOREIGN KEY ("punchItemId") REFERENCES "PunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchItemPhoto" ADD CONSTRAINT "PunchItemPhoto_punchItemId_fkey" FOREIGN KEY ("punchItemId") REFERENCES "PunchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

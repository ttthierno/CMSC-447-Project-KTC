-- AlterTable
ALTER TABLE "PunchItem" ADD COLUMN     "drawingId" INTEGER,
ADD COLUMN     "markerX" DOUBLE PRECISION,
ADD COLUMN     "markerY" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_drawingId_fkey" FOREIGN KEY ("drawingId") REFERENCES "Drawing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

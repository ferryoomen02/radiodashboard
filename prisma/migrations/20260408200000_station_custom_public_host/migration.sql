-- AlterTable
ALTER TABLE "Station" ADD COLUMN "customPublicHost" TEXT;

-- UniqueIndex
CREATE UNIQUE INDEX "Station_customPublicHost_key" ON "Station"("customPublicHost");

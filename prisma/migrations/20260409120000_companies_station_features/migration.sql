-- CreateEnum
CREATE TYPE "StationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");

-- AlterTable Station (nullable columns for backfill)
ALTER TABLE "Station" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Station" ADD COLUMN "slug" TEXT;
ALTER TABLE "Station" ADD COLUMN "status" "StationStatus" NOT NULL DEFAULT 'ACTIVE';

-- Default company for bestaande installaties
INSERT INTO "Company" ("id", "name", "slug", "metadata", "createdAt", "updatedAt")
VALUES ('cmcompdefaults0000001', 'Standaard organisatie', 'standaard', '{}', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE "Station" SET "companyId" = 'cmcompdefaults0000001' WHERE "companyId" IS NULL;

UPDATE "Station" SET "slug" = 'station-' || "id" WHERE "slug" IS NULL;

ALTER TABLE "Station" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "Station" ALTER COLUMN "slug" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Station" ADD CONSTRAINT "Station_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Station_companyId_idx" ON "Station"("companyId");
CREATE INDEX "Station_status_idx" ON "Station"("status");

CREATE UNIQUE INDEX "Station_slug_key" ON "Station"("slug");

-- CreateTable
CREATE TABLE "StationFeature" (
    "stationId" TEXT NOT NULL,
    "featureKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StationFeature_pkey" PRIMARY KEY ("stationId","featureKey")
);

ALTER TABLE "StationFeature" ADD CONSTRAINT "StationFeature_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "StationFeature_featureKey_idx" ON "StationFeature"("featureKey");

-- Backfill join table from bestaande JSON (PostgreSQL JSONB)
INSERT INTO "StationFeature" ("stationId", "featureKey", "createdAt")
SELECT s."id", elem, CURRENT_TIMESTAMP
FROM "Station" s
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s."enabledFeatures"::jsonb, '[]'::jsonb)) AS elem
ON CONFLICT ("stationId", "featureKey") DO NOTHING;

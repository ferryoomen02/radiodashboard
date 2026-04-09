-- Rename USER -> STAFF in Role enum (PostgreSQL)
ALTER TYPE "Role" RENAME VALUE 'USER' TO 'STAFF';

ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF'::"Role";

-- Invite lifecycle
CREATE TYPE "InviteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED');

ALTER TABLE "InviteToken" ADD COLUMN "status" "InviteStatus";

UPDATE "InviteToken" SET "status" = 'ACCEPTED' WHERE "usedAt" IS NOT NULL;
UPDATE "InviteToken" SET "status" = 'EXPIRED' WHERE "usedAt" IS NULL AND "expiresAt" < NOW();
UPDATE "InviteToken" SET "status" = 'PENDING' WHERE "status" IS NULL;

ALTER TABLE "InviteToken" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "InviteToken" ALTER COLUMN "status" SET DEFAULT 'PENDING';

ALTER TABLE "InviteToken" ADD COLUMN IF NOT EXISTS "emailSentAt" TIMESTAMP(3);
ALTER TABLE "InviteToken" ADD COLUMN IF NOT EXISTS "emailError" TEXT;

-- Per-user rechten binnen zender (JSON array)
ALTER TABLE "User" ADD COLUMN "permissions" JSONB NOT NULL DEFAULT '[]';

-- Media library
CREATE TABLE "MediaAsset" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "title" TEXT,
    "altText" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MediaAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MediaAsset_storageKey_key" ON "MediaAsset"("storageKey");
CREATE INDEX "MediaAsset_stationId_createdAt_idx" ON "MediaAsset"("stationId", "createdAt");

ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Station" ADD COLUMN "enabledFeatures" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "FeatureDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureDefinition_key_key" ON "FeatureDefinition"("key");

-- CreateTable
CREATE TABLE "InviteToken" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'SUPER_ADMIN',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InviteToken_tokenHash_key" ON "InviteToken"("tokenHash");

-- Bestaande zenders: alle standaardfuncties aan
UPDATE "Station" SET "enabledFeatures" = '["dashboard","tracks","users","stations","invites","djs","audiologger","files","site_settings"]'::jsonb;

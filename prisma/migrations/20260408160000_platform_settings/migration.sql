-- Platform branding & vaste portal-teksten (singleton rij id = default)
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "logoStorageKey" TEXT,
    "platformName" TEXT NOT NULL DEFAULT 'SonicWave',
    "subtitle" TEXT NOT NULL DEFAULT 'Platform',
    "texts" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "PlatformSettings" ("id", "platformName", "subtitle", "texts", "updatedAt")
VALUES ('default', 'SonicWave', 'Platform', '{}', CURRENT_TIMESTAMP);

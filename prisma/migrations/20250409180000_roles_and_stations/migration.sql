-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'STATION_ADMIN', 'USER');

-- AlterTable Station
ALTER TABLE "Station" ADD COLUMN IF NOT EXISTS "description" TEXT;

-- AlterTable User: name, role, updatedAt, nullable stationId, drop unique on stationId
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "Role" NOT NULL DEFAULT 'USER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DROP INDEX IF EXISTS "User_stationId_key";

ALTER TABLE "User" ALTER COLUMN "stationId" DROP NOT NULL;

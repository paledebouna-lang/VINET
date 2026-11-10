-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('ZONE_EXIT', 'POWER_CUT');

-- AlterTable
ALTER TABLE "vehicle" ADD COLUMN     "zoneLat" DOUBLE PRECISION,
ADD COLUMN     "zoneLng" DOUBLE PRECISION,
ADD COLUMN     "zoneRadiusKm" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "tracker" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "purgedAt" TIMESTAMP(3),

    CONSTRAINT "tracker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "position" (
    "id" TEXT NOT NULL,
    "trackerId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "accuracyM" INTEGER,
    "speedKmh" INTEGER,
    "powerCut" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "position_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alert" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "alert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tracker_vehicleId_key" ON "tracker"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_serial_key" ON "tracker"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "tracker_keyHash_key" ON "tracker"("keyHash");

-- CreateIndex
CREATE UNIQUE INDEX "position_trackerId_recordedAt_key" ON "position"("trackerId", "recordedAt");

-- CreateIndex
CREATE INDEX "alert_vehicleId_acknowledgedAt_idx" ON "alert"("vehicleId", "acknowledgedAt");

-- AddForeignKey
ALTER TABLE "tracker" ADD CONSTRAINT "tracker_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "position" ADD CONSTRAINT "position_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "tracker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert" ADD CONSTRAINT "alert_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

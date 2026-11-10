-- CreateEnum
CREATE TYPE "SightingKind" AS ENUM ('OBSERVATION', 'SUSPECT');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'REGISTRATION';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "vehicleId" TEXT;

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "vehicleId" TEXT;

-- CreateTable
CREATE TABLE "vehicle" (
    "id" TEXT NOT NULL,
    "avsId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "color" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "plate" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sighting" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "kind" "SightingKind" NOT NULL,
    "note" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracyM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "sighting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_avsId_key" ON "vehicle"("avsId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_serial_key" ON "vehicle"("serial");

-- CreateIndex
CREATE INDEX "vehicle_ownerId_idx" ON "vehicle"("ownerId");

-- CreateIndex
CREATE INDEX "sighting_vehicleId_createdAt_idx" ON "sighting"("vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX "sighting_reporterId_createdAt_idx" ON "sighting"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "document_vehicleId_idx" ON "document"("vehicleId");

-- AddForeignKey
ALTER TABLE "listing" ADD CONSTRAINT "listing_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sighting" ADD CONSTRAINT "sighting_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sighting" ADD CONSTRAINT "sighting_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

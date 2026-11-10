-- CreateEnum
CREATE TYPE "ListingKind" AS ENUM ('SALE', 'RENT');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('REQUESTED', 'DECLINED', 'ACCEPTED', 'SIGNED', 'ACTIVE', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InspectionPhase" AS ENUM ('DEPARTURE', 'RETURN');

-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('INSURANCE', 'LICENCE', 'INSPECTION');

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "depositFcfa" INTEGER,
ADD COLUMN     "gpsModel" TEXT,
ADD COLUMN     "gpsSerial" TEXT,
ADD COLUMN     "kind" "ListingKind" NOT NULL DEFAULT 'SALE',
ADD COLUMN     "kmPerDay" INTEGER,
ADD COLUMN     "zone" TEXT;

-- CreateTable
CREATE TABLE "booking" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "renterId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'REQUESTED',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "days" INTEGER NOT NULL,
    "pricePerDayFcfa" INTEGER NOT NULL,
    "totalFcfa" INTEGER NOT NULL,
    "depositFcfa" INTEGER NOT NULL,
    "renterFullName" TEXT NOT NULL,
    "licenceNumber" TEXT NOT NULL,
    "contractText" TEXT,
    "contractHash" TEXT,
    "ownerSignedAt" TIMESTAMP(3),
    "renterSignedAt" TIMESTAMP(3),
    "trackingConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inspection" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "phase" "InspectionPhase" NOT NULL,
    "mileageKm" INTEGER NOT NULL,
    "fuelPercent" INTEGER NOT NULL,
    "notes" TEXT,
    "depositDone" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confirmedAt" TIMESTAMP(3),

    CONSTRAINT "inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "listingId" TEXT,
    "bookingId" TEXT,
    "inspectionId" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "booking_listingId_status_idx" ON "booking"("listingId", "status");

-- CreateIndex
CREATE INDEX "booking_renterId_idx" ON "booking"("renterId");

-- CreateIndex
CREATE UNIQUE INDEX "inspection_bookingId_phase_key" ON "inspection"("bookingId", "phase");

-- CreateIndex
CREATE INDEX "document_listingId_idx" ON "document"("listingId");

-- CreateIndex
CREATE INDEX "document_bookingId_idx" ON "document"("bookingId");

-- CreateIndex
CREATE INDEX "document_inspectionId_idx" ON "document"("inspectionId");

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking" ADD CONSTRAINT "booking_renterId_fkey" FOREIGN KEY ("renterId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inspection" ADD CONSTRAINT "inspection_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_inspectionId_fkey" FOREIGN KEY ("inspectionId") REFERENCES "inspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

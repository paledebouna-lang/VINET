-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'INVOICE';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "serviceRecordId" TEXT;

-- CreateTable
CREATE TABLE "service_record" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mileageKm" INTEGER NOT NULL,
    "work" TEXT NOT NULL,
    "garage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_record_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_record_vehicleId_date_idx" ON "service_record"("vehicleId", "date");

-- CreateIndex
CREATE INDEX "document_serviceRecordId_idx" ON "document"("serviceRecordId");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_serviceRecordId_fkey" FOREIGN KEY ("serviceRecordId") REFERENCES "service_record"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_record" ADD CONSTRAINT "service_record_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;


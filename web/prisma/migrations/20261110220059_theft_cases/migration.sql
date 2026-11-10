-- CreateEnum
CREATE TYPE "CaseStatus" AS ENUM ('DECLARED', 'ACTIVE', 'CLOSED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CaseOutcome" AS ENUM ('RECOVERED', 'NOT_RECOVERED', 'FALSE_DECLARATION');

-- CreateEnum
CREATE TYPE "CaseEventKind" AS ENUM ('NOTE', 'OWNER_NOTE', 'OWNER_FOUND', 'EXPORT');

-- AlterEnum
ALTER TYPE "DocumentKind" ADD VALUE 'THEFT';

-- AlterTable
ALTER TABLE "document" ADD COLUMN     "theftCaseId" TEXT;

-- CreateTable
CREATE TABLE "theft_case" (
    "id" TEXT NOT NULL,
    "number" SERIAL NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "declarantId" TEXT NOT NULL,
    "status" "CaseStatus" NOT NULL DEFAULT 'DECLARED',
    "stolenAt" TIMESTAMP(3) NOT NULL,
    "place" TEXT NOT NULL,
    "circumstances" TEXT NOT NULL,
    "policeReference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    "decidedById" TEXT,
    "rejectionReason" TEXT,
    "closedAt" TIMESTAMP(3),
    "outcome" "CaseOutcome",
    "closingNote" TEXT,

    CONSTRAINT "theft_case_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_event" (
    "id" TEXT NOT NULL,
    "theftCaseId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "kind" "CaseEventKind" NOT NULL,
    "text" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "theft_case_number_key" ON "theft_case"("number");

-- CreateIndex
CREATE INDEX "theft_case_status_idx" ON "theft_case"("status");

-- CreateIndex
CREATE INDEX "theft_case_vehicleId_idx" ON "theft_case"("vehicleId");

-- CreateIndex
CREATE INDEX "case_event_theftCaseId_createdAt_idx" ON "case_event"("theftCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "document_theftCaseId_idx" ON "document"("theftCaseId");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_theftCaseId_fkey" FOREIGN KEY ("theftCaseId") REFERENCES "theft_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theft_case" ADD CONSTRAINT "theft_case_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "theft_case" ADD CONSTRAINT "theft_case_declarantId_fkey" FOREIGN KEY ("declarantId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_theftCaseId_fkey" FOREIGN KEY ("theftCaseId") REFERENCES "theft_case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_event" ADD CONSTRAINT "case_event_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

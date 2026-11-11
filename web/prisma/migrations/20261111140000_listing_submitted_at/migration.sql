-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "listing" SET "submittedAt" = "createdAt";

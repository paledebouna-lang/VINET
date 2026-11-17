-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "riskFlags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "listing_photo" ADD COLUMN     "phash" TEXT;


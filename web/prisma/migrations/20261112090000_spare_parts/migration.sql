-- AlterEnum
ALTER TYPE "Category" ADD VALUE 'PIECE';

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "partCondition" TEXT,
ADD COLUMN     "partName" TEXT,
ADD COLUMN     "partReference" TEXT,
ALTER COLUMN "year" DROP NOT NULL,
ALTER COLUMN "mileageKm" DROP NOT NULL,
ALTER COLUMN "fuel" DROP NOT NULL,
ALTER COLUMN "transmission" DROP NOT NULL;


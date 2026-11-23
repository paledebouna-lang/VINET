-- AlterTable
ALTER TABLE "booking" ADD COLUMN     "pricePerMonthFcfa" INTEGER,
ADD COLUMN     "pricePerWeekFcfa" INTEGER;

-- AlterTable
ALTER TABLE "listing" ADD COLUMN     "pricePerMonthFcfa" INTEGER,
ADD COLUMN     "pricePerWeekFcfa" INTEGER;


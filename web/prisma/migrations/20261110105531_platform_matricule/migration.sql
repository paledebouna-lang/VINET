-- AlterTable
ALTER TABLE "seller_profile" DROP COLUMN "matricule",
ALTER COLUMN "yearsExperience" DROP NOT NULL,
ALTER COLUMN "company" DROP NOT NULL,
ALTER COLUMN "position" DROP NOT NULL;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "memberNumber" SERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "user_memberNumber_key" ON "user"("memberNumber");


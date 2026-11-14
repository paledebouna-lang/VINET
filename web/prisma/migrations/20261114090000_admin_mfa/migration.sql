-- AlterTable
ALTER TABLE "session" ADD COLUMN     "mfaVerifiedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "admin_mfa" (
    "userId" TEXT NOT NULL,
    "sealedSecret" TEXT,
    "pendingSecret" TEXT,
    "lastStep" INTEGER NOT NULL DEFAULT -1,
    "enabledAt" TIMESTAMP(3),

    CONSTRAINT "admin_mfa_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "admin_mfa" ADD CONSTRAINT "admin_mfa_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- AlterTable
ALTER TABLE "user" ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ticket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bookingId" TEXT,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answer" TEXT,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ticket_answeredAt_idx" ON "ticket"("answeredAt");

-- CreateIndex
CREATE INDEX "ticket_userId_idx" ON "ticket"("userId");

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "ticket_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

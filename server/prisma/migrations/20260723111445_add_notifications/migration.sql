-- AlterTable
ALTER TABLE "UserBill" ADD COLUMN     "lastKnownStatus" TEXT,
ADD COLUMN     "notifyEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "NotificationLog_userId_idx" ON "NotificationLog"("userId");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLog_userId_billId_type_ref_key" ON "NotificationLog"("userId", "billId", "type", "ref");

-- CreateIndex
CREATE INDEX "UserBill_notifyEnabled_watching_idx" ON "UserBill"("notifyEnabled", "watching");

-- CreateTable
CREATE TABLE "UserBill" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "watching" BOOLEAN NOT NULL DEFAULT false,
    "stance" TEXT,
    "priority" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserBill_userId_idx" ON "UserBill"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBill_userId_billId_key" ON "UserBill"("userId", "billId");

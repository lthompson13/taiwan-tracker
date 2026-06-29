-- DropIndex
DROP INDEX "Bill_latestProgressDate_idx";

-- DropIndex
DROP INDEX "Bill_status_idx";

-- DropIndex
DROP INDEX "Bill_term_session_idx";

-- CreateTable
CREATE TABLE "UserTag" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBillTag" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBillTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserTag_userId_idx" ON "UserTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserTag_userId_name_key" ON "UserTag"("userId", "name");

-- CreateIndex
CREATE INDEX "UserBillTag_userId_idx" ON "UserBillTag"("userId");

-- CreateIndex
CREATE INDEX "UserBillTag_userId_billId_idx" ON "UserBillTag"("userId", "billId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBillTag_userId_billId_tagId_key" ON "UserBillTag"("userId", "billId", "tagId");

-- AddForeignKey
ALTER TABLE "UserBillTag" ADD CONSTRAINT "UserBillTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "UserTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

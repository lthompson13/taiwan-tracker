-- CreateTable
CREATE TABLE "Bill" (
    "id" SERIAL NOT NULL,
    "billId" TEXT NOT NULL,
    "billName" TEXT,
    "billNameZh" TEXT,
    "term" INTEGER,
    "session" INTEGER,
    "category" TEXT,
    "status" TEXT,
    "proposer" TEXT,
    "source" TEXT,
    "latestProgressDate" TEXT,
    "referenceNumber" TEXT,
    "sectors" TEXT[],
    "url" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bill_billId_key" ON "Bill"("billId");

-- CreateIndex
CREATE INDEX "Bill_term_session_idx" ON "Bill"("term", "session");

-- CreateIndex
CREATE INDEX "Bill_status_idx" ON "Bill"("status");

-- CreateIndex
CREATE INDEX "Bill_latestProgressDate_idx" ON "Bill"("latestProgressDate");

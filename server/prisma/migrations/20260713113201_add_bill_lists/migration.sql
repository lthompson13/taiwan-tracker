-- CreateTable
CREATE TABLE "BillList" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillListItem" (
    "id" SERIAL NOT NULL,
    "listId" INTEGER NOT NULL,
    "billId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillListItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BillList_userId_idx" ON "BillList"("userId");

-- CreateIndex
CREATE INDEX "BillListItem_listId_idx" ON "BillListItem"("listId");

-- CreateIndex
CREATE UNIQUE INDEX "BillListItem_listId_billId_key" ON "BillListItem"("listId", "billId");

-- AddForeignKey
ALTER TABLE "BillListItem" ADD CONSTRAINT "BillListItem_listId_fkey" FOREIGN KEY ("listId") REFERENCES "BillList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

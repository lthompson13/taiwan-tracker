-- CreateTable
CREATE TABLE "BillTextTranslation" (
    "billId" TEXT NOT NULL,
    "reason" TEXT,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillTextTranslation_pkey" PRIMARY KEY ("billId")
);

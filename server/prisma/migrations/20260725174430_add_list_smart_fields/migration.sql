-- AlterTable
ALTER TABLE "BillList" ADD COLUMN     "filterCriteria" JSONB,
ADD COLUMN     "notifyEnabled" BOOLEAN NOT NULL DEFAULT false;

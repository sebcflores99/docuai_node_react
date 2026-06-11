-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "confidence" DOUBLE PRECISION,
ADD COLUMN     "sources" JSONB;

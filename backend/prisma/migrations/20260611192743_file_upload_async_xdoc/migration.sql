/*
  Warnings:

  - You are about to drop the column `documentId` on the `Conversation` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Conversation" DROP CONSTRAINT "Conversation_documentId_fkey";

-- DropIndex
DROP INDEX "Conversation_documentId_idx";

-- AlterTable
ALTER TABLE "Conversation" DROP COLUMN "documentId",
ADD COLUMN     "documentIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "error" TEXT,
ADD COLUMN     "fileName" TEXT,
ADD COLUMN     "mimeType" TEXT,
ADD COLUMN     "progress" INTEGER,
ADD COLUMN     "sizeBytes" INTEGER;

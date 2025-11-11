/*
  Warnings:

  - Added the required column `updatedAt` to the `Receipt` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "public"."Receipt" DROP CONSTRAINT "Receipt_projectId_fkey";

-- AlterTable
ALTER TABLE "public"."Receipt" 
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW(),
ADD COLUMN "userId" INTEGER,
ALTER COLUMN "projectId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Receipt_userId_idx" ON "public"."Receipt"("userId");

-- CreateIndex
CREATE INDEX "Receipt_uploadedAt_idx" ON "public"."Receipt"("uploadedAt");

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_userId_fkey" 
FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_projectId_fkey" 
FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

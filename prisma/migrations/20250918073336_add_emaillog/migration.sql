/*
  Warnings:

  - You are about to alter the column `error` on the `EmailLog` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(1000)`.
  - Changed the type of `status` on the `EmailLog` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "public"."EmailLog" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL,
ALTER COLUMN "error" SET DATA TYPE VARCHAR(1000);

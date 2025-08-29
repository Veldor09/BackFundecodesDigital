/*
  Warnings:

  - The primary key for the `Project` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `Project` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "public"."ProjectStatus" AS ENUM ('EN_PROCESO', 'FINALIZADO', 'PAUSADO');

-- AlterTable
ALTER TABLE "public"."Project" DROP CONSTRAINT "Project_pkey",
ADD COLUMN     "area" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "place" TEXT,
ADD COLUMN     "status" "public"."ProjectStatus" NOT NULL DEFAULT 'EN_PROCESO',
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "Project_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE INDEX "News_updatedAt_idx" ON "public"."News"("updatedAt");

-- CreateIndex
CREATE INDEX "News_published_idx" ON "public"."News"("published");

-- CreateIndex
CREATE INDEX "Project_updatedAt_idx" ON "public"."Project"("updatedAt");

-- CreateIndex
CREATE INDEX "Project_category_idx" ON "public"."Project"("category");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "public"."Project"("status");

-- CreateIndex
CREATE INDEX "Project_place_idx" ON "public"."Project"("place");

-- CreateIndex
CREATE INDEX "Project_area_idx" ON "public"."Project"("area");

/*
  Warnings:

  - The primary key for the `ContactMessage` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `ContactMessage` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `News` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `News` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[title,place,area]` on the table `Project` will be added. If there are existing duplicate values, this will fail.
  - Made the column `area` on table `Project` required. This step will fail if there are existing NULL values in that column.
  - Made the column `category` on table `Project` required. This step will fail if there are existing NULL values in that column.
  - Made the column `place` on table `Project` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."News_published_idx";

-- DropIndex
DROP INDEX "public"."News_updatedAt_idx";

-- DropIndex
DROP INDEX "public"."Project_area_idx";

-- DropIndex
DROP INDEX "public"."Project_category_idx";

-- DropIndex
DROP INDEX "public"."Project_place_idx";

-- DropIndex
DROP INDEX "public"."Project_status_idx";

-- DropIndex
DROP INDEX "public"."Project_updatedAt_idx";

-- AlterTable
ALTER TABLE "public"."ContactMessage" DROP CONSTRAINT "ContactMessage_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."News" DROP CONSTRAINT "News_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" SERIAL NOT NULL,
ADD CONSTRAINT "News_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "public"."Project" ALTER COLUMN "area" SET NOT NULL,
ALTER COLUMN "category" SET NOT NULL,
ALTER COLUMN "place" SET NOT NULL;

-- CreateTable
CREATE TABLE "public"."Volunteer" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "disponibilidad" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Volunteer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_title_place_area_key" ON "public"."Project"("title", "place", "area");

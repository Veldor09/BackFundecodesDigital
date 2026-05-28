/*
  Warnings:

  - Made the column `nombre` on table `voluntario` required. This step will fail if there are existing NULL values in that column.
  - Made the column `fecha_entrada` on table `voluntario` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
ALTER TYPE "ColaboradorRol" ADD VALUE 'colaboradorvisitacion';

-- DropIndex
DROP INDEX "Project_areaId_idx";

-- DropIndex
DROP INDEX "programa_voluntariado_areaId_idx";

-- AlterTable
ALTER TABLE "voluntario" ALTER COLUMN "nombre" SET NOT NULL,
ALTER COLUMN "fecha_entrada" SET NOT NULL;

-- CreateTable
CREATE TABLE "visitacion" (
    "id" SERIAL NOT NULL,
    "fecha" DATE NOT NULL,
    "total_personas" INTEGER NOT NULL,
    "nacionales" INTEGER NOT NULL,
    "extranjeros" INTEGER NOT NULL,
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "visitacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitacion_fecha_idx" ON "visitacion"("fecha");

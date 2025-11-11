/*
  Warnings:

  - You are about to drop the column `fechaGeneracion` on the `Reporte` table. All the data in the column will be lost.
  - You are about to drop the column `mimeType` on the `Reporte` table. All the data in the column will be lost.
  - You are about to drop the column `nombreArchivo` on the `Reporte` table. All the data in the column will be lost.
  - You are about to drop the column `parametros` on the `Reporte` table. All the data in the column will be lost.
  - You are about to drop the column `urlArchivo` on the `Reporte` table. All the data in the column will be lost.
  - Added the required column `filename` to the `Reporte` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mime` to the `Reporte` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Reporte` table without a default value. This is not possible if the table is not empty.
  - Made the column `bytes` on table `Reporte` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "public"."Auditoria_createdAt_idx";

-- DropIndex
DROP INDEX "public"."Reporte_fechaGeneracion_idx";

-- DropIndex
DROP INDEX "public"."Reporte_projectId_idx";

-- AlterTable
ALTER TABLE "public"."Reporte" DROP COLUMN "fechaGeneracion",
DROP COLUMN "mimeType",
DROP COLUMN "nombreArchivo",
DROP COLUMN "parametros",
DROP COLUMN "urlArchivo",
ADD COLUMN     "filename" TEXT NOT NULL,
ADD COLUMN     "mime" TEXT NOT NULL,
ADD COLUMN     "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "url" TEXT NOT NULL,
ALTER COLUMN "bytes" SET NOT NULL;

/*
  Warnings:

  - The `archivos` column on the `SolicitudCompra` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "public"."SolicitudCompra" ADD COLUMN     "usuarioId" INTEGER,
DROP COLUMN "archivos",
ADD COLUMN     "archivos" TEXT[];

/*
  Warnings:

  - You are about to drop the column `comentario` on the `SolicitudCompra` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."SolicitudCompra" DROP COLUMN "comentario",
ADD COLUMN     "comentarioContadora" TEXT,
ADD COLUMN     "comentarioDirector" TEXT;

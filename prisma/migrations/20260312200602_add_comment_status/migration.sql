/*
  Warnings:

  - The primary key for the `Comment` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the `project_volunteer` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."VoluntariadoOrigen" AS ENUM ('CUENTA_PROPIA', 'INTERMEDIARIO');

-- CreateEnum
CREATE TYPE "public"."CommentStatus" AS ENUM ('PENDIENTE', 'APROBADO', 'DENEGADO');

-- DropForeignKey
ALTER TABLE "public"."project_volunteer" DROP CONSTRAINT "project_volunteer_projectId_fkey";

-- DropForeignKey
ALTER TABLE "public"."project_volunteer" DROP CONSTRAINT "project_volunteer_voluntarioId_fkey";

-- AlterTable
ALTER TABLE "public"."Comment" DROP CONSTRAINT "Comment_pkey",
ADD COLUMN     "status" "public"."CommentStatus" NOT NULL DEFAULT 'PENDIENTE',
ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "id" SET DATA TYPE TEXT,
ALTER COLUMN "visible" SET DEFAULT false,
ADD CONSTRAINT "Comment_pkey" PRIMARY KEY ("id");
DROP SEQUENCE "Comment_id_seq";

-- DropTable
DROP TABLE "public"."project_volunteer";

-- CreateTable
CREATE TABLE "public"."programa_voluntariado" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "lugar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programa_voluntariado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."programa_voluntariado_asignacion" (
    "programaId" INTEGER NOT NULL,
    "voluntarioId" INTEGER NOT NULL,
    "pago_realizado" BOOLEAN NOT NULL DEFAULT false,
    "origen" "public"."VoluntariadoOrigen" NOT NULL DEFAULT 'CUENTA_PROPIA',
    "intermediario" VARCHAR(160),
    "fecha_entrada" TIMESTAMP(3) NOT NULL,
    "fecha_salida" TIMESTAMP(3),
    "horas_totales" INTEGER NOT NULL DEFAULT 0,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "programa_voluntariado_asignacion_pkey" PRIMARY KEY ("programaId","voluntarioId")
);

-- CreateIndex
CREATE INDEX "programa_voluntariado_nombre_idx" ON "public"."programa_voluntariado"("nombre");

-- CreateIndex
CREATE INDEX "programa_voluntariado_asignacion_voluntarioId_idx" ON "public"."programa_voluntariado_asignacion"("voluntarioId");

-- CreateIndex
CREATE INDEX "programa_voluntariado_asignacion_programaId_idx" ON "public"."programa_voluntariado_asignacion"("programaId");

-- AddForeignKey
ALTER TABLE "public"."programa_voluntariado_asignacion" ADD CONSTRAINT "programa_voluntariado_asignacion_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "public"."programa_voluntariado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."programa_voluntariado_asignacion" ADD CONSTRAINT "programa_voluntariado_asignacion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "public"."voluntario"("id") ON DELETE CASCADE ON UPDATE CASCADE;

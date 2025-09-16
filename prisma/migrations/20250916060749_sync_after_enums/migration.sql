-- CreateEnum
CREATE TYPE "public"."ColaboradorRol" AS ENUM ('ADMIN', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "public"."ColaboradorEstado" AS ENUM ('ACTIVO', 'INACTIVO');

-- CreateTable
CREATE TABLE "public"."colaborador" (
    "id" SERIAL NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "correo" VARCHAR(160) NOT NULL,
    "cedula" VARCHAR(25) NOT NULL,
    "fecha_nacimiento" TIMESTAMP(3),
    "telefono" VARCHAR(25),
    "rol" "public"."ColaboradorRol" NOT NULL DEFAULT 'COLABORADOR',
    "password_hash" VARCHAR(255) NOT NULL,
    "estado" "public"."ColaboradorEstado" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "colaborador_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_correo_key" ON "public"."colaborador"("correo");

-- CreateIndex
CREATE UNIQUE INDEX "colaborador_cedula_key" ON "public"."colaborador"("cedula");

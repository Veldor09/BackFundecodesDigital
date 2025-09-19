/*
  Warnings:

  - You are about to drop the `Volunteer` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
DROP TABLE "public"."Volunteer";

-- CreateTable
CREATE TABLE "public"."VolunteerForm" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "disponibilidad" TEXT NOT NULL,
    "mensaje" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolunteerForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voluntario" (
    "id" SERIAL NOT NULL,
    "tipo_documento" TEXT NOT NULL,
    "numero_documento" VARCHAR(25) NOT NULL,
    "nombre_completo" TEXT NOT NULL,
    "email" VARCHAR(160) NOT NULL,
    "telefono" VARCHAR(25),
    "fecha_nacimiento" TIMESTAMP(3),
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "estado" "public"."ColaboradorEstado" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voluntario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "voluntario_numero_documento_key" ON "public"."voluntario"("numero_documento");

-- CreateIndex
CREATE UNIQUE INDEX "voluntario_email_key" ON "public"."voluntario"("email");

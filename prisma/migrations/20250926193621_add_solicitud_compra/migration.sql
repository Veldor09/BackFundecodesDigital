-- CreateEnum
CREATE TYPE "public"."PasswordChangeType" AS ENUM ('RESET', 'MANUAL', 'INVITE_SET');

-- CreateEnum
CREATE TYPE "public"."SancionTipo" AS ENUM ('LEVE', 'GRAVE', 'MUY_GRAVE', 'EXTREMADAMENTE_GRAVE');

-- CreateEnum
CREATE TYPE "public"."SancionEstado" AS ENUM ('ACTIVA', 'EXPIRADA', 'REVOCADA');

-- CreateTable
CREATE TABLE "public"."PasswordChangeLog" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "ip" TEXT,
    "type" "public"."PasswordChangeType" NOT NULL DEFAULT 'RESET',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."project_volunteer" (
    "projectId" INTEGER NOT NULL,
    "voluntarioId" INTEGER NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_volunteer_pkey" PRIMARY KEY ("projectId","voluntarioId")
);

-- CreateTable
CREATE TABLE "public"."Sancion" (
    "id" SERIAL NOT NULL,
    "voluntarioId" INTEGER NOT NULL,
    "tipo" "public"."SancionTipo" NOT NULL,
    "motivo" TEXT NOT NULL,
    "descripcion" TEXT,
    "fechaInicio" TIMESTAMP(3) NOT NULL,
    "fechaVencimiento" TIMESTAMP(3),
    "estado" "public"."SancionEstado" NOT NULL DEFAULT 'ACTIVA',
    "creadaPor" TEXT,
    "revocadaPor" TEXT,
    "fechaRevocacion" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sancion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PasswordChangeLog_userId_createdAt_idx" ON "public"."PasswordChangeLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Sancion_voluntarioId_idx" ON "public"."Sancion"("voluntarioId");

-- CreateIndex
CREATE INDEX "Sancion_estado_idx" ON "public"."Sancion"("estado");

-- AddForeignKey
ALTER TABLE "public"."PasswordChangeLog" ADD CONSTRAINT "PasswordChangeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_volunteer" ADD CONSTRAINT "project_volunteer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."project_volunteer" ADD CONSTRAINT "project_volunteer_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "public"."voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sancion" ADD CONSTRAINT "Sancion_voluntarioId_fkey" FOREIGN KEY ("voluntarioId") REFERENCES "public"."voluntario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

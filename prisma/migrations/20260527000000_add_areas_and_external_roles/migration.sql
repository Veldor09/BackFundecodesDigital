-- =============================================================
--  Migration: add_areas_and_external_roles
--  Adds the Area entity and two new external ColaboradorRol values.
--  NOTE: ALTER TYPE ... ADD VALUE cannot run inside a transaction,
--  so those statements are placed outside BEGIN/COMMIT blocks.
-- =============================================================

-- AddValue: new external roles (safe to re-run; IF NOT EXISTS guards)
ALTER TYPE "ColaboradorRol" ADD VALUE IF NOT EXISTS 'colaboradorsolicitante';
ALTER TYPE "ColaboradorRol" ADD VALUE IF NOT EXISTS 'colaboradorvoluntariadoexterno';

-- CreateTable: area
CREATE TABLE "area" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "area_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "area_nombre_key" ON "area"("nombre");

-- CreateIndex
CREATE INDEX "area_activa_idx" ON "area"("activa");

-- AlterTable: Cuenta — add areaId (nullable, unique → 1 account per area)
ALTER TABLE "Cuenta" ADD COLUMN "areaId" INTEGER;

-- CreateIndex (unique: 1 area = 1 account)
CREATE UNIQUE INDEX "Cuenta_areaId_key" ON "Cuenta"("areaId");

-- AlterTable: Project — add areaId (nullable)
ALTER TABLE "Project" ADD COLUMN "areaId" INTEGER;

-- CreateIndex
CREATE INDEX "Project_areaId_idx" ON "Project"("areaId");

-- AlterTable: programa_voluntariado — add areaId (nullable)
ALTER TABLE "programa_voluntariado" ADD COLUMN "areaId" INTEGER;

-- CreateIndex
CREATE INDEX "programa_voluntariado_areaId_idx" ON "programa_voluntariado"("areaId");

-- AlterTable: colaborador — add areaId (nullable)
ALTER TABLE "colaborador" ADD COLUMN "areaId" INTEGER;

-- CreateIndex
CREATE INDEX "colaborador_areaId_idx" ON "colaborador"("areaId");

-- AddForeignKey: Cuenta → area
ALTER TABLE "Cuenta" ADD CONSTRAINT "Cuenta_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "area"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: Project → area
ALTER TABLE "Project" ADD CONSTRAINT "Project_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "area"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: programa_voluntariado → area
ALTER TABLE "programa_voluntariado" ADD CONSTRAINT "programa_voluntariado_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "area"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: colaborador → area
ALTER TABLE "colaborador" ADD CONSTRAINT "colaborador_areaId_fkey"
    FOREIGN KEY ("areaId") REFERENCES "area"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

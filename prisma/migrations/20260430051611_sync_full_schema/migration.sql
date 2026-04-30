-- CreateEnum
CREATE TYPE "TipoOrigenSolicitud" AS ENUM ('PROGRAMA', 'PROYECTO');

-- AlterTable
ALTER TABLE "Auditoria" ADD COLUMN     "entidad" TEXT,
ADD COLUMN     "entidadId" TEXT,
ADD COLUMN     "ip" TEXT,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "userAgent" TEXT,
ADD COLUMN     "userEmail" TEXT,
ADD COLUMN     "userName" TEXT;

-- AlterTable
ALTER TABLE "SolicitudCompra" ADD COLUMN     "monto" DECIMAL(16,2),
ADD COLUMN     "programaId" INTEGER,
ADD COLUMN     "projectId" INTEGER,
ADD COLUMN     "tipoOrigen" "TipoOrigenSolicitud";

-- CreateIndex
CREATE INDEX "Auditoria_userId_createdAt_idx" ON "Auditoria"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Auditoria_entidad_entidadId_idx" ON "Auditoria"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "Auditoria_accion_idx" ON "Auditoria"("accion");

-- CreateIndex
CREATE INDEX "SolicitudCompra_programaId_idx" ON "SolicitudCompra"("programaId");

-- CreateIndex
CREATE INDEX "SolicitudCompra_projectId_idx" ON "SolicitudCompra"("projectId");

-- CreateIndex
CREATE INDEX "SolicitudCompra_usuarioId_idx" ON "SolicitudCompra"("usuarioId");

-- AddForeignKey
ALTER TABLE "SolicitudCompra" ADD CONSTRAINT "SolicitudCompra_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa_voluntariado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCompra" ADD CONSTRAINT "SolicitudCompra_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

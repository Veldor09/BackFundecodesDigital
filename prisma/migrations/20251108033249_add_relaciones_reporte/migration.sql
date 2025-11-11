-- AlterTable
ALTER TABLE "public"."Auditoria" ADD COLUMN     "modulo" TEXT,
ADD COLUMN     "reporteId" INTEGER,
ADD COLUMN     "resultado" TEXT;

-- CreateTable
CREATE TABLE "public"."Reporte" (
    "id" SERIAL NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "urlArchivo" TEXT NOT NULL,
    "mimeType" TEXT,
    "bytes" INTEGER,
    "projectId" INTEGER,
    "userId" INTEGER,
    "parametros" JSONB,
    "fechaGeneracion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Reporte_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reporte_fechaGeneracion_idx" ON "public"."Reporte"("fechaGeneracion");

-- CreateIndex
CREATE INDEX "Reporte_projectId_idx" ON "public"."Reporte"("projectId");

-- CreateIndex
CREATE INDEX "Auditoria_createdAt_idx" ON "public"."Auditoria"("createdAt");

-- AddForeignKey
ALTER TABLE "public"."Auditoria" ADD CONSTRAINT "Auditoria_reporteId_fkey" FOREIGN KEY ("reporteId") REFERENCES "public"."Reporte"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporte" ADD CONSTRAINT "Reporte_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Reporte" ADD CONSTRAINT "Reporte_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

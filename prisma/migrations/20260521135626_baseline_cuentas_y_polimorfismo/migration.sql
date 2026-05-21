/*
  Warnings:

  - A unique constraint covering the columns `[paymentId]` on the table `Transaccion` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[anulaTransaccionId]` on the table `Transaccion` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "BillingRequest" DROP CONSTRAINT "BillingRequest_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_projectId_fkey";

-- DropForeignKey
ALTER TABLE "Transaccion" DROP CONSTRAINT "Transaccion_projectId_fkey";

-- AlterTable
ALTER TABLE "BillingRequest" ADD COLUMN     "cuentaId" INTEGER,
ADD COLUMN     "programaId" INTEGER,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "cuentaId" INTEGER,
ADD COLUMN     "programaId" INTEGER,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "cuentaId" INTEGER,
ADD COLUMN     "monedaPresupuesto" "Currency" NOT NULL DEFAULT 'CRC',
ADD COLUMN     "presupuestoTotal" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Transaccion" ADD COLUMN     "anulaTransaccionId" TEXT,
ADD COLUMN     "anuladaAt" TIMESTAMP(3),
ADD COLUMN     "anuladaPor" INTEGER,
ADD COLUMN     "cuentaId" INTEGER,
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "programaId" INTEGER,
ALTER COLUMN "projectId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "programa_voluntariado" ADD COLUMN     "cuentaId" INTEGER,
ADD COLUMN     "monedaPresupuesto" "Currency" NOT NULL DEFAULT 'CRC',
ADD COLUMN     "presupuestoTotal" DECIMAL(16,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Cuenta" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "descripcion" TEXT,
    "monedaBase" "Currency" NOT NULL DEFAULT 'CRC',
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cuenta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ColaboradorAsignacion" (
    "id" SERIAL NOT NULL,
    "collaboratorId" INTEGER NOT NULL,
    "projectId" INTEGER,
    "programaId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ColaboradorAsignacion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cuenta_codigo_key" ON "Cuenta"("codigo");

-- CreateIndex
CREATE INDEX "Cuenta_activa_idx" ON "Cuenta"("activa");

-- CreateIndex
CREATE INDEX "ColaboradorAsignacion_collaboratorId_idx" ON "ColaboradorAsignacion"("collaboratorId");

-- CreateIndex
CREATE INDEX "ColaboradorAsignacion_projectId_idx" ON "ColaboradorAsignacion"("projectId");

-- CreateIndex
CREATE INDEX "ColaboradorAsignacion_programaId_idx" ON "ColaboradorAsignacion"("programaId");

-- CreateIndex
CREATE UNIQUE INDEX "ColaboradorAsignacion_collaboratorId_projectId_key" ON "ColaboradorAsignacion"("collaboratorId", "projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ColaboradorAsignacion_collaboratorId_programaId_key" ON "ColaboradorAsignacion"("collaboratorId", "programaId");

-- CreateIndex
CREATE INDEX "BillingRequest_programaId_idx" ON "BillingRequest"("programaId");

-- CreateIndex
CREATE INDEX "BillingRequest_cuentaId_idx" ON "BillingRequest"("cuentaId");

-- CreateIndex
CREATE INDEX "Payment_programaId_date_idx" ON "Payment"("programaId", "date");

-- CreateIndex
CREATE INDEX "Payment_cuentaId_date_idx" ON "Payment"("cuentaId", "date");

-- CreateIndex
CREATE INDEX "Project_cuentaId_idx" ON "Project"("cuentaId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_paymentId_key" ON "Transaccion"("paymentId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaccion_anulaTransaccionId_key" ON "Transaccion"("anulaTransaccionId");

-- CreateIndex
CREATE INDEX "Transaccion_programaId_fecha_tipo_idx" ON "Transaccion"("programaId", "fecha", "tipo");

-- CreateIndex
CREATE INDEX "Transaccion_cuentaId_fecha_idx" ON "Transaccion"("cuentaId", "fecha");

-- CreateIndex
CREATE INDEX "programa_voluntariado_cuentaId_idx" ON "programa_voluntariado"("cuentaId");

-- AddForeignKey
ALTER TABLE "ColaboradorAsignacion" ADD CONSTRAINT "ColaboradorAsignacion_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "colaborador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorAsignacion" ADD CONSTRAINT "ColaboradorAsignacion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ColaboradorAsignacion" ADD CONSTRAINT "ColaboradorAsignacion_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa_voluntariado"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programa_voluntariado" ADD CONSTRAINT "programa_voluntariado_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_anulaTransaccionId_fkey" FOREIGN KEY ("anulaTransaccionId") REFERENCES "Transaccion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa_voluntariado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaccion" ADD CONSTRAINT "Transaccion_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa_voluntariado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_programaId_fkey" FOREIGN KEY ("programaId") REFERENCES "programa_voluntariado"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_cuentaId_fkey" FOREIGN KEY ("cuentaId") REFERENCES "Cuenta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

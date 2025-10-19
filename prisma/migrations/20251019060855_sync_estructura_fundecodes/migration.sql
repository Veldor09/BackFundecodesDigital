-- CreateEnum
CREATE TYPE "public"."TipoTransaccion" AS ENUM ('ingreso', 'egreso');

-- CreateEnum
CREATE TYPE "public"."EstadoContadora" AS ENUM ('PENDIENTE', 'VALIDADA', 'DEVUELTA');

-- CreateEnum
CREATE TYPE "public"."EstadoDirector" AS ENUM ('PENDIENTE', 'APROBADA', 'RECHAZADA');

-- CreateEnum
CREATE TYPE "public"."Currency" AS ENUM ('CRC', 'USD', 'EUR');

-- CreateEnum
CREATE TYPE "public"."BillingRequestStatus" AS ENUM ('PENDING', 'VALIDATED', 'APPROVED', 'REJECTED', 'PAID');

-- AlterTable
ALTER TABLE "public"."SolicitudCompra" ADD COLUMN     "estadoContadora" "public"."EstadoContadora" NOT NULL DEFAULT 'PENDIENTE',
ADD COLUMN     "estadoDirector" "public"."EstadoDirector" NOT NULL DEFAULT 'PENDIENTE',
ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';

-- DropEnum
DROP TYPE "public"."SolicitudEstado";

-- CreateTable
CREATE TABLE "public"."Presupuesto" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "proyecto" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "montoAsignado" DECIMAL(16,2) NOT NULL,
    "montoEjecutado" DECIMAL(16,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Presupuesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Transaccion" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "proyecto" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipo" "public"."TipoTransaccion" NOT NULL,
    "categoria" TEXT NOT NULL,
    "descripcion" TEXT NOT NULL,
    "monto" DECIMAL(16,2) NOT NULL,
    "moneda" "public"."Currency" NOT NULL DEFAULT 'CRC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentoContable" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "proyecto" TEXT NOT NULL,
    "mes" INTEGER NOT NULL,
    "anio" INTEGER NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipoMime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentoContable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingRequest" (
    "id" SERIAL NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "concept" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "status" "public"."BillingRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdBy" TEXT,
    "draftInvoiceUrl" TEXT,
    "history" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BillingInvoice" (
    "id" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "total" DECIMAL(16,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "url" TEXT,
    "mime" TEXT,
    "bytes" INTEGER,
    "isValid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProgramAllocation" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "concept" TEXT NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProgramAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Payment" (
    "id" TEXT NOT NULL,
    "requestId" INTEGER NOT NULL,
    "projectId" INTEGER NOT NULL,
    "amount" DECIMAL(16,2) NOT NULL,
    "currency" "public"."Currency" NOT NULL,
    "reference" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    "paymentId" TEXT,
    "url" TEXT NOT NULL,
    "mime" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Presupuesto_projectId_anio_mes_idx" ON "public"."Presupuesto"("projectId", "anio", "mes");

-- CreateIndex
CREATE INDEX "Transaccion_projectId_fecha_tipo_idx" ON "public"."Transaccion"("projectId", "fecha", "tipo");

-- CreateIndex
CREATE INDEX "DocumentoContable_projectId_anio_mes_idx" ON "public"."DocumentoContable"("projectId", "anio", "mes");

-- CreateIndex
CREATE INDEX "BillingRequest_projectId_idx" ON "public"."BillingRequest"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_requestId_key" ON "public"."BillingInvoice"("requestId");

-- CreateIndex
CREATE INDEX "BillingInvoice_projectId_date_idx" ON "public"."BillingInvoice"("projectId", "date");

-- CreateIndex
CREATE INDEX "ProgramAllocation_projectId_date_idx" ON "public"."ProgramAllocation"("projectId", "date");

-- CreateIndex
CREATE INDEX "Payment_projectId_date_idx" ON "public"."Payment"("projectId", "date");

-- CreateIndex
CREATE INDEX "Receipt_projectId_uploadedAt_idx" ON "public"."Receipt"("projectId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "public"."Presupuesto" ADD CONSTRAINT "Presupuesto_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Transaccion" ADD CONSTRAINT "Transaccion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DocumentoContable" ADD CONSTRAINT "DocumentoContable_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingRequest" ADD CONSTRAINT "BillingRequest_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingInvoice" ADD CONSTRAINT "BillingInvoice_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."BillingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BillingInvoice" ADD CONSTRAINT "BillingInvoice_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProgramAllocation" ADD CONSTRAINT "ProgramAllocation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Payment" ADD CONSTRAINT "Payment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "public"."BillingRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "public"."Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

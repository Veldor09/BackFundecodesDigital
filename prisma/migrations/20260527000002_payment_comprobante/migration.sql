-- =============================================================
--  Migration: payment_comprobante
--  Adds comprobante_url and comprobante_key to Payment.
--  Allows the accountant to attach a payment receipt (PDF/image).
-- =============================================================

-- AlterTable
ALTER TABLE "Payment"
  ADD COLUMN "comprobante_url" TEXT,
  ADD COLUMN "comprobante_key" TEXT;

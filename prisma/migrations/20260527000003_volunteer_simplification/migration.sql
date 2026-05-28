-- =============================================================
--  Migration: volunteer_simplification
--  Simplifies the Voluntario model to: nombre, nacionalidad,
--  fechaEntrada, fechaSalida, ong.
--  Old fields are made nullable (existing rows are test data).
--  A cron job will delete volunteers the day after fechaSalida.
-- =============================================================

-- Add new simplified fields
ALTER TABLE "voluntario"
  ADD COLUMN "nombre"        TEXT,
  ADD COLUMN "nacionalidad"  TEXT,
  ADD COLUMN "fecha_entrada" TIMESTAMP(3),
  ADD COLUMN "fecha_salida"  TIMESTAMP(3),
  ADD COLUMN "ong"           TEXT;

-- Backfill nombre from nombreCompleto for existing rows
UPDATE "voluntario" SET "nombre" = "nombre_completo" WHERE "nombre" IS NULL;

-- Backfill fechaEntrada from fechaIngreso for existing rows
UPDATE "voluntario" SET "fecha_entrada" = "fecha_ingreso" WHERE "fecha_entrada" IS NULL;

-- Set a default fechaEntrada for any remaining null rows
UPDATE "voluntario" SET "fecha_entrada" = NOW() WHERE "fecha_entrada" IS NULL;

-- Set a default nombre for any remaining null rows
UPDATE "voluntario" SET "nombre" = 'Sin nombre' WHERE "nombre" IS NULL;

-- Make old required columns nullable (backward compat with existing test data)
ALTER TABLE "voluntario"
  ALTER COLUMN "tipo_documento"   DROP NOT NULL,
  ALTER COLUMN "numero_documento" DROP NOT NULL,
  ALTER COLUMN "nombre_completo"  DROP NOT NULL,
  ALTER COLUMN "email"            DROP NOT NULL,
  ALTER COLUMN "fecha_ingreso"    DROP NOT NULL,
  ALTER COLUMN "estado"           DROP NOT NULL;

-- Create index on fecha_salida (used by cron job query)
CREATE INDEX "voluntario_fecha_salida_idx" ON "voluntario"("fecha_salida");

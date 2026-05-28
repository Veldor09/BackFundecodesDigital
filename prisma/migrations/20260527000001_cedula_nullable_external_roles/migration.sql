-- =============================================================
--  Migration: cedula_nullable_external_roles
--  Makes the cedula column nullable to support external
--  collaborators who don't have a Costa Rican ID number.
--  PostgreSQL allows multiple NULL values in a UNIQUE column.
-- =============================================================

-- AlterTable
ALTER TABLE "colaborador" ALTER COLUMN "cedula" DROP NOT NULL;

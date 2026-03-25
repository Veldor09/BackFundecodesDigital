/*
  Warnings:

  - The values [REVISADO,RESPONDIDO] on the enum `EstadoRespuestaFormulario` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "EstadoRespuestaFormulario_new" AS ENUM ('PENDIENTE', 'ACEPTADO', 'RECHAZADO');
ALTER TABLE "public"."respuestas_formulario" ALTER COLUMN "estado" DROP DEFAULT;
ALTER TABLE "respuestas_formulario" ALTER COLUMN "estado" TYPE "EstadoRespuestaFormulario_new" USING ("estado"::text::"EstadoRespuestaFormulario_new");
ALTER TYPE "EstadoRespuestaFormulario" RENAME TO "EstadoRespuestaFormulario_old";
ALTER TYPE "EstadoRespuestaFormulario_new" RENAME TO "EstadoRespuestaFormulario";
DROP TYPE "public"."EstadoRespuestaFormulario_old";
ALTER TABLE "respuestas_formulario" ALTER COLUMN "estado" SET DEFAULT 'PENDIENTE';
COMMIT;

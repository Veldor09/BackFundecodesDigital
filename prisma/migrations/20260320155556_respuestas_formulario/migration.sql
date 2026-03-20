-- CreateEnum
CREATE TYPE "public"."TipoFormulario" AS ENUM ('CONTACTO', 'VOLUNTARIADO', 'ALIANZA', 'COMENTARIO');

-- CreateEnum
CREATE TYPE "public"."EstadoRespuestaFormulario" AS ENUM ('PENDIENTE', 'REVISADO', 'RESPONDIDO');

-- CreateTable
CREATE TABLE "public"."respuestas_formulario" (
    "id" TEXT NOT NULL,
    "tipoFormulario" "public"."TipoFormulario" NOT NULL,
    "nombre" TEXT,
    "correo" TEXT,
    "telefono" TEXT,
    "payload" JSONB NOT NULL,
    "estado" "public"."EstadoRespuestaFormulario" NOT NULL DEFAULT 'PENDIENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "respuestas_formulario_pkey" PRIMARY KEY ("id")
);

/*
  Warnings:

  - The values [ADMIN,COLABORADOR] on the enum `ColaboradorRol` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "public"."ColaboradorRol_new" AS ENUM ('admin', 'colaboradorfactura', 'colaboradorvoluntariado', 'colaboradorproyecto', 'colaboradorcontabilidad');
ALTER TABLE "public"."colaborador" ALTER COLUMN "rol" DROP DEFAULT;
ALTER TABLE "public"."colaborador" ALTER COLUMN "rol" TYPE "public"."ColaboradorRol_new" USING ("rol"::text::"public"."ColaboradorRol_new");
ALTER TYPE "public"."ColaboradorRol" RENAME TO "ColaboradorRol_old";
ALTER TYPE "public"."ColaboradorRol_new" RENAME TO "ColaboradorRol";
DROP TYPE "public"."ColaboradorRol_old";
ALTER TABLE "public"."colaborador" ALTER COLUMN "rol" SET DEFAULT 'colaboradorproyecto';
COMMIT;

-- AlterTable
ALTER TABLE "public"."BillingRequest" ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'CRC';

-- AlterTable
ALTER TABLE "public"."colaborador" ALTER COLUMN "rol" SET DEFAULT 'colaboradorproyecto';

-- CreateTable
CREATE TABLE "public"."Comment" (
    "id" SERIAL NOT NULL,
    "author" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

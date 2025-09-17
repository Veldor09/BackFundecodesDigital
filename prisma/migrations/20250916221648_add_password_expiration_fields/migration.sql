-- AlterTable
ALTER TABLE "public"."colaborador" ADD COLUMN     "password_updated_at" TIMESTAMP(3),
ADD COLUMN     "temp_password_expires_at" TIMESTAMP(3);

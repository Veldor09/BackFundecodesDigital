-- AlterTable
ALTER TABLE "public"."SolicitudCompra" ALTER COLUMN "estado" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "public"."SolicitudCompra" ADD CONSTRAINT "SolicitudCompra_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

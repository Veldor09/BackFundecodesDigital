-- AlterTable
ALTER TABLE "BillingRequest" ADD COLUMN     "areaId" INTEGER;

-- AlterTable
ALTER TABLE "SolicitudCompra" ADD COLUMN     "areaId" INTEGER;

-- CreateIndex
CREATE INDEX "BillingRequest_areaId_idx" ON "BillingRequest"("areaId");

-- CreateIndex
CREATE INDEX "SolicitudCompra_areaId_idx" ON "SolicitudCompra"("areaId");

-- AddForeignKey
ALTER TABLE "SolicitudCompra" ADD CONSTRAINT "SolicitudCompra_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingRequest" ADD CONSTRAINT "BillingRequest_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

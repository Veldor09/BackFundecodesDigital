-- CreateTable
CREATE TABLE "public"."SolicitudHistorial" (
    "id" SERIAL NOT NULL,
    "solicitudId" INTEGER NOT NULL,
    "estadoAnterior" TEXT NOT NULL,
    "estadoNuevo" TEXT NOT NULL,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudHistorial_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SolicitudHistorial_solicitudId_idx" ON "public"."SolicitudHistorial"("solicitudId");

-- CreateIndex
CREATE INDEX "SolicitudHistorial_userId_idx" ON "public"."SolicitudHistorial"("userId");

-- AddForeignKey
ALTER TABLE "public"."SolicitudHistorial" ADD CONSTRAINT "SolicitudHistorial_solicitudId_fkey" FOREIGN KEY ("solicitudId") REFERENCES "public"."SolicitudCompra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SolicitudHistorial" ADD CONSTRAINT "SolicitudHistorial_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

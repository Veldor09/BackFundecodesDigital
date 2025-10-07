import { Module } from '@nestjs/common';
import { PresupuestosController } from './presupuestos/presupuestos.controller';
import { PresupuestosService } from './presupuestos/presupuestos.service';
import { TransaccionesController } from './transacciones/transacciones.controller';
import { TransaccionesService } from './transacciones/transacciones.service';
import { DocumentosController } from './documentos/documentos.controller';
import { DocumentosService } from './documentos/documentos.service';

@Module({
  controllers: [PresupuestosController, TransaccionesController, DocumentosController],
  providers: [PresupuestosService, TransaccionesService, DocumentosService],
})
export class ContabilidadModule {}

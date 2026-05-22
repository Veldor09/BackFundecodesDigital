// src/SistemaAdmin/cuentas/cuentas.module.ts
import { Module } from '@nestjs/common';
import { CuentasController } from './cuentas.controller';
import { CuentasService } from './cuentas.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Módulo de Cuentas contables — contenedor financiero principal del
 * módulo de Contabilidad. Una cuenta agrupa proyectos y/o programas;
 * sus totales se calculan al vuelo a partir de las transacciones cuyo
 * snapshot `cuentaId` apunte a ella.
 */
@Module({
  controllers: [CuentasController],
  providers: [CuentasService, PrismaService],
  exports: [CuentasService],
})
export class CuentasModule {}

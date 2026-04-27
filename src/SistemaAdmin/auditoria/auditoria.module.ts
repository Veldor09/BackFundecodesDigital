// src/SistemaAdmin/auditoria/auditoria.module.ts
import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditInterceptor } from './audit.interceptor';
import { AuditoriaController } from './auditoria.controller';
import { AuditoriaService } from './auditoria.service';

/**
 * Módulo global. Cualquier service/controller del sistema puede:
 *   - inyectar `AuditoriaService` para registrar eventos manualmente, o
 *   - decorar un endpoint con `@Audit({...})` y dejar que el interceptor
 *     global lo registre automáticamente tras la ejecución.
 */
@Global()
@Module({
  controllers: [AuditoriaController],
  providers: [
    PrismaService,
    AuditoriaService,
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
  ],
  exports: [AuditoriaService],
})
export class AuditoriaModule {}

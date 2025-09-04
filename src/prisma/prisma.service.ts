// src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: ['warn', 'error'], // ajusta a ['query','info','warn','error'] si quieres más logs en dev
    });
    // Sin middleware ($use). Tu lógica de normalización/slug está en los services.
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * En Prisma 5+ (library engine) el hook 'beforeExit' ya no está en prisma.$on.
   * Debemos usar process.on('beforeExit') / señales del sistema.
   */
  async enableShutdownHooks(app: INestApplication) {
    const closeApp = async () => {
      try {
        await app.close();
      } catch {
        // ignora errores al cerrar
      }
    };

    // Cierre cuando Node está por salir
    process.on('beforeExit', closeApp);

    // Cierre por señales comunes
    process.on('SIGINT', closeApp);
    process.on('SIGTERM', closeApp);
    process.on('SIGUSR2', closeApp); // nodemon
  }
}

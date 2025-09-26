// src/prisma/prisma.service.ts
import {
  Injectable,
  INestApplication,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ['warn', 'error'], 
      // En desarrollo puedes usar: ['query', 'info', 'warn', 'error']
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * En Prisma 5+ (library engine) el evento `beforeExit` ya no se usa igual.
   * Implementamos shutdown hooks para NestJS manualmente.
   */
  async enableShutdownHooks(app: INestApplication) {
    const closeApp = async () => {
      try {
        await app.close();
      } catch (e) {
        // Ignora errores de cierre
      }
    };

    process.on('beforeExit', closeApp);
    process.on('SIGINT', closeApp);
    process.on('SIGTERM', closeApp);
    process.on('SIGUSR2', closeApp); // nodemon
  }
}

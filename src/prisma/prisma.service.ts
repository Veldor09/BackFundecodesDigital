import { INestApplication, Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // Si en algún momento quieres cerrar la app Nest cuando Prisma emite beforeExit,
  // puedes reactivar este método (ver Opción C).
  // enableShutdownHooks(app: INestApplication) {
  //   this.$on('beforeExit' as any, async () => {
  //     await app.close();
  //   });
  // }
}

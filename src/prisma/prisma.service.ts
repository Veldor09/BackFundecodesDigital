import { INestApplication, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
        // activa ‘query’ si quieres ver consultas:
        // { level: 'query', emit: 'event' },
      ],
    });
  }

  async onModuleInit() {
    // this.$on('query', (e) => console.log('[PRISMA]', e.query, e.params));
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  // enableShutdownHooks(app: INestApplication) {
  //   this.$on('beforeExit' as any, async () => {
  //     await app.close();
  //   });
  // }
}

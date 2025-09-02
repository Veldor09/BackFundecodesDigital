// src/prisma/prisma.service.ts
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

function slugify(input: string): string {
  return (input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super();

    // 👉 Solo registra middleware si existe $use en runtime
    const maybeUse = (this as any)?.$use;
    if (typeof maybeUse === 'function') {
      maybeUse.call(this, async (params: any, next: any) => {
        if (params?.model === 'Project') {
          const action = params.action;
          const data = (params.args?.data ?? {}) as any;

          if (action === 'create') {
            if (!data.slug || typeof data.slug !== 'string' || data.slug.trim() === '') {
              const title = typeof data.title === 'string' ? data.title.trim() : '';
              const place = typeof data.place === 'string' ? data.place.trim() : '';
              if (title && place) data.slug = slugify(`${title}-${place}`);
            } else {
              data.slug = slugify(data.slug);
            }
          } else if (action === 'update' || action === 'upsert') {
            if (typeof data.slug === 'string' && data.slug.trim().length > 0) {
              data.slug = slugify(data.slug);
            } else {
              const hasTitle = typeof data.title === 'string' && data.title.trim().length > 0;
              const hasPlace = typeof data.place === 'string' && data.place.trim().length > 0;
              if (hasTitle && hasPlace) {
                data.slug = slugify(`${data.title.trim()}-${data.place.trim()}`);
              }
            }
          }

          params.args.data = data;
        }

        return next(params);
      });
    } else {
      // No rompas la app si no existe $use (algunos entornos raros)
      // console.warn('[Prisma] $use no disponible; el slug se generará en el service/trigger.');
    }
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

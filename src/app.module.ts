// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './SistemaAdmin/projects/projects.module';
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersModule } from './PaginaInfo/volunteers/volunteers.module';
import { CacheModule } from '@nestjs/cache-manager';

CacheModule.register({ isGlobal: true, ttl: 60_000, max: 500 })


@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProjectsModule,
    NewsModule,
    ContactModule,
    VolunteersModule,
  ],
})
export class AppModule {}

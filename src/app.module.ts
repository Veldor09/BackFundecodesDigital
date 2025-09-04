// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './SistemaAdmin/projects/projects.module';
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersModule } from './PaginaInfo/volunteers/volunteers.module';

@Module({
  imports: [
    // Configuración global de variables de entorno
    ConfigModule.forRoot({ isGlobal: true }),

    // Base de datos (Prisma)
    PrismaModule,

    // Módulos de dominio
    ProjectsModule,
    NewsModule,
    ContactModule,
    VolunteersModule,
  ],
  controllers: [], // 👈 no hay controladores directos en AppModule
  providers: [],   // 👈 ni providers, solo módulos compuestos
})
export class AppModule {}

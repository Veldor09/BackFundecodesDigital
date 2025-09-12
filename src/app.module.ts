import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';

import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './SistemaAdmin/projects/projects.module';
import { DashboardModule } from './SistemaAdmin/dashboard/dashboard.module';
import { FilesModule } from './SistemaAdmin/files/files.module';
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersModule } from './PaginaInfo/volunteers/volunteers.module';
import { InformationalPageModule } from './PaginaInfo/informational-page.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './SistemaAdmin/users/users.module';

// 👇 IMPORTA el RolesModule
import { RolesModule } from './SistemaAdmin/roles/roles.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000, // 1 minuto por defecto
      max: 500,
    }),
    PrismaModule,
    ProjectsModule,
    DashboardModule,
    FilesModule,
    NewsModule,
    ContactModule,
    VolunteersModule,
    InformationalPageModule,
    AuthModule,
    UsersModule,

    // 👇 AGREGA EL MÓDULO DE ROLES
    RolesModule,
  ],
})
export class AppModule {}

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

// Roles
import { RolesModule } from './SistemaAdmin/roles/roles.module';

// 👇 NUEVO: Colaboradores
import { CollaboratorsModule } from './SistemaAdmin/collaborator/collaborators.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    CacheModule.register({
      isGlobal: true,
      ttl: 60_000, // 1 minuto por defecto
      max: 500,
    }),
    PrismaModule,

    // Sistema Admin
    ProjectsModule,
    DashboardModule,
    FilesModule,
    UsersModule,
    RolesModule,
    CollaboratorsModule, // 👈 registrado aquí

    // Público / Páginas informativas
    NewsModule,
    ContactModule,
    VolunteersModule,
    InformationalPageModule,

    // Auth
    AuthModule,
  ],
})
export class AppModule {}

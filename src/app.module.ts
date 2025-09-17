// src/app.module.ts
import { Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule } from '@nestjs/config';
import Joi from 'joi';

import { PrismaModule } from './prisma/prisma.module';

// Sistema Admin
import { ProjectsModule } from './SistemaAdmin/projects/projects.module';
import { DashboardModule } from './SistemaAdmin/dashboard/dashboard.module';
import { FilesModule } from './SistemaAdmin/files/files.module';
import { UsersModule } from './SistemaAdmin/users/users.module';
import { RolesModule } from './SistemaAdmin/roles/roles.module';
import { CollaboratorsModule } from './SistemaAdmin/collaborator/collaborators.module';

// Público
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersModule } from './PaginaInfo/volunteers/volunteers.module';
import { InformationalPageModule } from './PaginaInfo/informational-page.module';

// Auth
import { AuthModule } from './auth/auth.module';

// Comunes
import { CommonModule } from './common/common.module';

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().default(4000),

        // DB
        DATABASE_URL: Joi.string().uri().required(),

        // Front para el link de set-password
        FRONTEND_URL: Joi.string().uri().required(),
        FRONTEND_SET_PASSWORD_PATH: Joi.string().default('/set-password'),

        // SendGrid (opcional en dev, requerido en prod)
        SENDGRID_API_KEY: isDev
          ? Joi.string().min(10).optional()
          : Joi.string().min(10).required(),
        MAIL_FROM: Joi.string().default('Fundecodes <no-reply@fundecodes.org>'),

        // Token de set-password (30m por defecto)
        PASSWORD_JWT_SECRET: Joi.string().min(16).required(),
        PASSWORD_JWT_EXPIRES: Joi.alternatives(
          Joi.number(),
          Joi.string(), // '30m', '1h', etc.
        ).default('30m'),

        // CORS / Proxy
        TRUST_PROXY: Joi.string().valid('0', '1').default('0'),
      }),
    }),

    CacheModule.register({
      isGlobal: true,
      ttl: 60_000, // 1 minuto (ms)
      max: 500,
    }),

    PrismaModule,

    // Sistema Admin
    ProjectsModule,
    DashboardModule,
    FilesModule,
    UsersModule,
    RolesModule,
    CollaboratorsModule,

    // Público
    NewsModule,
    ContactModule,
    VolunteersModule,
    InformationalPageModule,

    // Auth
    AuthModule,

    // Servicios comunes (token + email + welcome flow)
    CommonModule,
  ],
})
export class AppModule {}

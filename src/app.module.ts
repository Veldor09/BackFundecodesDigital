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
import { VolunteerModule } from './SistemaAdmin/Volunteer/volunteer.module';
import { SancionesModule } from './SistemaAdmin/sanciones/sanciones.module';

// Público
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersFormModule } from './PaginaInfo/volunteers/volunteer-form.module';
import { InformationalPageModule } from './PaginaInfo/informational-page.module';

// Auth
import { AuthModule } from './auth/auth.module';

// Comunes
import { CommonModule } from './common/common.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // --- APP ---
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(4000),

        // --- DB ---
        DATABASE_URL: Joi.string().uri().required(),

        // --- FRONT (links de set-password) ---
        FRONTEND_URL: Joi.string().uri().required(),
        FRONTEND_SET_PASSWORD_PATH: Joi.string().default('/set-password'),

        // --- JWTs ---
        PASSWORD_JWT_SECRET: Joi.string().min(16).required(),
        PASSWORD_JWT_EXPIRES: Joi.alternatives().try(Joi.number(), Joi.string()).default('30m'),
        JWT_SECRET: Joi.string().default('dev-secret'),

        // --- Email (MailerSend SMTP) ---
        MAIL_HOST: Joi.string().default('smtp.mailersend.net'),
        MAIL_PORT: Joi.number().default(587),           // usa 2525 si tu red bloquea 587
        MAIL_USERNAME: Joi.string().allow('').default(''),
        MAIL_PASSWORD: Joi.string().allow('').default(''),
        MAIL_FROM: Joi.string().default('Fundecodes <no-reply@test.mlsender.net>'),
        SEND_EMAILS: Joi.string().valid('true', 'false').default('true'),

        // --- (Legacy) SENDGRID opcional: ya no se usa, pero no bloquea el arranque ---
        SENDGRID_API_KEY: Joi.string().optional(),

        // --- Otros ---
        TRUST_PROXY: Joi.string().valid('0', '1').default('0'),
      }),
    }),

    CacheModule.register({
      isGlobal: true,
      ttl: 60_000,
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
    VolunteerModule,
    SancionesModule,

    // Público
    NewsModule,
    ContactModule,
    VolunteersFormModule,
    InformationalPageModule,

    // Auth
    AuthModule,

    // Servicios comunes (token + email + welcome flow)
    CommonModule,
  ],
})
export class AppModule {}

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
import { SolicitudesModule } from './SistemaAdmin/solicitudes/solicitudes.module';
import { ContabilidadModule } from './SistemaAdmin/contabilidad/contabilidad.module';
import { BillingModule } from './SistemaAdmin/billing/billing.module';
import { ReportesModule } from './SistemaAdmin/reportes/reportes.module';

// Público
import { NewsModule } from './news/news.module';
import { ContactModule } from './PaginaInfo/contact/contact.module';
import { VolunteersFormModule } from './PaginaInfo/volunteers/volunteer-form.module';
import { InformationalPageModule } from './PaginaInfo/informational-page.module';
import { CommentsModule } from './PaginaInfo/comments/comments.module';

// Auth
import { AuthModule } from './auth/auth.module';

// Comunes
import { CommonModule } from './common/common.module';

import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        // --- APP ---
        NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
        PORT: Joi.number().default(4000),

        // --- DB (aceptar postgres/postgresql y validar ambas) ---
        DATABASE_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),
        DIRECT_URL: Joi.string()
          .uri({ scheme: ['postgres', 'postgresql'] })
          .required(),

        // --- FRONT (permitir http/https) ---
        FRONTEND_URL: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
        FRONTEND_SET_PASSWORD_PATH: Joi.string().default('/set-password'),
        FRONTEND_RESET_PASSWORD_PATH: Joi.string().default('/reset-password'),

        // --- JWTs ---
        PASSWORD_JWT_SECRET: Joi.string().min(16).required(),
        PASSWORD_JWT_EXPIRES: Joi.alternatives().try(Joi.number(), Joi.string()).default('30m'),
        JWT_SECRET: Joi.string().default('dev-secret'),
        RESET_JWT_SECRET: Joi.string().min(16).required(),
        RESET_JWT_EXPIRES: Joi.alternatives().try(Joi.number(), Joi.string()).default('30m'),

        // --- Email ---
        MAIL_HOST: Joi.string().default('smtp.mailersend.net'),
        MAIL_PORT: Joi.number().default(587),
        MAIL_USERNAME: Joi.string().allow('').default(''),
        MAIL_PASSWORD: Joi.string().allow('').default(''),
        MAIL_FROM: Joi.string().default('Fundecodes <no-reply@test.mlsender.net>'),
        SEND_EMAILS: Joi.string().valid('true', 'false').default('true'),

        // --- Otros ---
        TRUST_PROXY: Joi.string().valid('0', '1').default('0'),
      }),
    }),

    CacheModule.register({isGlobal: true, ttl: 60_000, max: 500,}),

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
    SolicitudesModule,
    ContabilidadModule,
    BillingModule,
    ReportesModule, // ✅ añadido aquí

    // Público
    NewsModule,
    ContactModule,
    VolunteersFormModule,
    InformationalPageModule,
    CommentsModule,

    // Auth
    AuthModule,

    
    // Comunes
    CommonModule,
  ],

  controllers: [AppController],
  providers: [AppService],  
})
export class AppModule {}

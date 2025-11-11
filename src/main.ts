// src/main.ts
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

<<<<<<< HEAD
  app.setGlobalPrefix('api');

  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === FRONTEND_URL || /^http:\/\/localhost:\d+$/i.test(origin)) return callback(null, true);
      return callback(new Error('CORS bloqueado'), false);
=======
  // ✅ Prefijo global para toda la API
  app.setGlobalPrefix('api');

  // Archivos estáticos (p.ej. /uploads/*)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Límites de body (JSON / forms)
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS (permite FRONTEND y Swagger UI)
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const swaggerOrigin = 'http://localhost:4000'; // UI que sirve Nest

  app.enableCors({
    origin: (origin, cb) => {
      // Permite llamadas de tu front, Swagger UI local y herramientas sin origin (curl/Postman)
      if (!origin) return cb(null, true);
      if (
        origin === FRONTEND_URL ||
        origin === swaggerOrigin ||
        /^http:\/\/localhost:\d+$/i.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(null, false);
>>>>>>> e794a9eef6b111b82ba28e81c871152a956f5c1b
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'Cache-Control',
      'Pragma',
    ],
    exposedHeaders: ['ETag'],
  });

<<<<<<< HEAD
=======
  // Validación global
>>>>>>> e794a9eef6b111b82ba28e81c871152a956f5c1b
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

<<<<<<< HEAD
  app.useGlobalFilters(new HttpExceptionFilter());

  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  const publicServer = process.env.PUBLIC_API_URL || 'http://localhost:4000/api';

  const swaggerConfig = new DocumentBuilder()
    .setTitle('FUNDECODES API')
    .setDescription('API pública y de administración del sistema FUNDECODES. Incluye módulos administrativos, reportes, documentos y autenticación.')
=======
  // Filtro global de excepciones
  app.useGlobalFilters(new HttpExceptionFilter());

  // Proxy/CDN opcional
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  // ───────────────────────────────
  // Swagger (con Bearer y persistAuth)
  // ───────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FUNDECODES API')
    .setDescription('API pública y de administración de FUNDECODES')
>>>>>>> e794a9eef6b111b82ba28e81c871152a956f5c1b
    .setVersion('1.0')
    // Importante: el nombre 'bearer' debe coincidir con @ApiBearerAuth('bearer') en tus controladores
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
<<<<<<< HEAD
        description: 'Ingresa tu token JWT (puedes incluir o no el prefijo "Bearer ").',
=======
        description: 'Pega tu token JWT (con o sin el prefijo "Bearer ").',
>>>>>>> e794a9eef6b111b82ba28e81c871152a956f5c1b
        in: 'header',
      },
      'bearer',
    )
<<<<<<< HEAD
    .addServer(publicServer)
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, { ignoreGlobalPrefix: true });

  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tryItOutEnabled: true },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API:      http://localhost:${port}/api`);
  console.log(`📘 Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS:     ${FRONTEND_URL}`);
  console.log('============================================================');
=======
    // 👇 Apunta al server con el prefijo global
    .addServer('http://localhost:4000/api')
    .build();

  // 👇 Evita que Swagger duplique el prefijo (/api/api/...)
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true, // mantiene el token entre recargas
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  // Prisma: cierre limpio
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // Arranque
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log(
    `🚀 API running on http://localhost:${port}/api | Swagger: http://localhost:${port}/docs`,
  );
>>>>>>> e794a9eef6b111b82ba28e81c871152a956f5c1b
}

bootstrap();

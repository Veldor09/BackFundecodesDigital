// src/main.ts
import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, RequestMethod } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';

import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';

import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 🔹 Prefijo global para API, pero excluye "/" (GET y HEAD) para que no dé 404
  app.setGlobalPrefix('api', {
    exclude: [
      { path: '/', method: RequestMethod.GET },
      { path: '/', method: RequestMethod.HEAD },
    ],
  });

  // Archivos estáticos
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Body parsers
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS
  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (origin === FRONTEND_URL || /^http:\/\/localhost:\d+$/i.test(origin)) return callback(null, true);
      return callback(new Error('CORS bloqueado'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'], // ← añade HEAD
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

  // Pipes y filtros globales
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Proxy (Render/Heroku)
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  // Swagger
  const publicServer = process.env.PUBLIC_API_URL || 'http://localhost:4000/api';
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FUNDECODES API')
    .setDescription('API pública y de administración del sistema FUNDECODES. Incluye módulos administrativos, reportes, documentos y autenticación.')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Ingresa tu token JWT (puedes incluir o no el prefijo "Bearer ").',
        in: 'header',
      },
      'bearer',
    )
    .addServer(publicServer)
    .build();

  // ⚠️ ignoreGlobalPrefix NO para swagger; lo servimos en /docs (sin /api)
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tryItOutEnabled: true },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  // Prisma shutdown hooks
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // Puerto correcto para Render
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API:      http://localhost:${port}/api`);
  console.log(`📘 Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS:     ${FRONTEND_URL}`);
  console.log('============================================================');
}

bootstrap();

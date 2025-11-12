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

function parseAllowedOrigins(envValue?: string): string[] {
  if (!envValue) return [];
  return envValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Todas tus rutas bajo /api
  app.setGlobalPrefix('api');

  // Archivos estáticos (si usas /uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Body parsers
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // === CORS robusto ===
  // FRONTEND_URL: un solo origen "fijo"
  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');

  // ALLOWED_ORIGINS: lista separada por comas (útil para previews de Vercel, pruebas locales, etc.)
  // Ejemplo en Render:
  // ALLOWED_ORIGINS=https://front-fundecodes-digital-cedl.vercel.app,https://backfundecodesdigital.onrender.com,http://localhost:5173
  const extraAllowed = parseAllowedOrigins(process.env.ALLOWED_ORIGINS);
  const allowList = new Set<string>([FRONTEND_URL, ...extraAllowed]);

  // Patrones (regex) que aceptamos además de la lista exacta:
  // - Cualquier preview de vercel.app de tu proyecto (opcional)
  const vercelPattern = /^https?:\/\/[a-z0-9-]+\.vercel\.app$/i;
  // - Localhost con cualquier puerto
  const localhostPattern = /^http:\/\/localhost:\d+$/i;

  app.enableCors({
    origin: (origin, callback) => {
      // Thunder Client / curl / Swagger (sin Origin): permitir
      if (!origin) return callback(null, true);

      // Coincidencia exacta con allowList
      if (allowList.has(origin)) return callback(null, true);

      // Coincidencia por patrones
      if (localhostPattern.test(origin)) return callback(null, true);
      if (vercelPattern.test(origin)) return callback(null, true);

      // (Opcional) permite onrender.com para abrir Swagger desde el propio dominio
      if (/\.onrender\.com$/i.test(origin)) return callback(null, true);

      // Si no se permite:
      return callback(new Error('CORS bloqueado'), false);
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
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Validaciones
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Filtro global de errores
  app.useGlobalFilters(new HttpExceptionFilter());

  // Proxy (Render)
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);

  // Swagger
  const publicServer = process.env.PUBLIC_API_URL || 'http://localhost:4000/api';
  const swaggerConfig = new DocumentBuilder()
    .setTitle('FUNDECODES API')
    .setDescription(
      'API pública y de administración del sistema FUNDECODES. Incluye módulos administrativos, reportes, documentos y autenticación.',
    )
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

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, { ignoreGlobalPrefix: true });
  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: { persistAuthorization: true, displayRequestDuration: true, tryItOutEnabled: true },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  // Prisma shutdown hooks
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API:      http://localhost:${port}/api`);
  console.log(`📘 Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS base: ${FRONTEND_URL}`);
  console.log(`🌍 Extra:    ${[...allowList].join(', ')}`);
  console.log('============================================================');
}

bootstrap();

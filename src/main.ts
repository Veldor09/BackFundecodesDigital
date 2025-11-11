// ============================================================
// src/main.ts
// ============================================================

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

  // ============================================================
  // 🌐 Prefijo global para toda la API
  // ============================================================
  app.setGlobalPrefix('api');

  // ============================================================
  // 📁 Archivos estáticos (p.ej. /uploads/*)
  // ============================================================
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // ============================================================
  // ⚙️ Configuración de body parsers
  // ============================================================
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ============================================================
  // 🧩 CORS (Frontend + Swagger + Postman)
  // ============================================================
  const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
  const swaggerOrigin = 'http://localhost:4000';

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // Permite llamadas sin origen (CLI, Postman)
      if (
        origin === FRONTEND_URL ||
        origin === swaggerOrigin ||
        /^http:\/\/localhost:\d+$/i.test(origin)
      ) {
        return callback(null, true);
      }
      console.warn(`🚫 Bloqueado por CORS: ${origin}`);
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
  });

  // ============================================================
  // 🛡️ Validación global
  // ============================================================
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ============================================================
  // 🚨 Filtro global de excepciones
  // ============================================================
  app.useGlobalFilters(new HttpExceptionFilter());

  // ============================================================
  // 🧱 Proxy/CDN opcional (si está detrás de un reverse proxy)
  // ============================================================
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  // ============================================================
  // 📘 Swagger (con JWT Bearer y persistencia del token)
  // ============================================================
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
        description:
          'Ingresa tu token JWT (puedes incluir o no el prefijo "Bearer ").',
        in: 'header',
      },
      'bearer', // 👈 nombre de referencia usado en @ApiBearerAuth('bearer')
    )
    .addServer('http://localhost:4000/api') // apunta correctamente al prefijo global
    .build();

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true, // evita /api/api duplicado
  });

  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true, // conserva el token al recargar
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  // ============================================================
  // 🧩 Prisma: cierre limpio
  // ============================================================
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // ============================================================
  // 🚀 Inicialización del servidor
  // ============================================================
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API corriendo en:       http://localhost:${port}/api`);
  console.log(`📘 Documentación Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS habilitado para:   ${FRONTEND_URL}`);
  console.log('============================================================');
}

bootstrap();

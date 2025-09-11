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

// ⬇️ NUEVO: filtro global de errores estándar
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Archivos estáticos: /uploads/*
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // (Opcional) Aumentar límite de body si lo necesitas
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // CORS
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3000';
  app.enableCors({
    origin: [allowedOrigin],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin', 'X-Requested-With', 'Content-Type', 'Accept',
      'Authorization', 'Cache-Control', 'Pragma',
    ],
    exposedHeaders: ['ETag'],
  });

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // ⬇️ NUEVO: aplicar filtro global de excepciones
  app.useGlobalFilters(new HttpExceptionFilter());

  // Proxy/CDN opcional
  if (process.env.TRUST_PROXY === '1') {
    app.set('trust proxy', 1);
  }

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('FUNDECODES API')
    .setDescription('API pública para sitio informativo')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'Authorization',
        description: 'Pega aquí tu token JWT (sin comillas).',
        in: 'header',
      },
      'bearer',
    )
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  // Prisma: cierre limpio
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);

  const url = `http://localhost:${port}`;
  console.log(`🚀 API running on ${url} | Swagger: ${url}/docs`);
}

bootstrap();

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

function parseCsv(v?: string) {
  return (v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function env(k: string, d = '') {
  return (process.env[k] ?? d).toString().trim();
}

function buildAllowedOrigins() {
  const defaults = [
    'https://backfundecodesdigital.onrender.com',
    'https://front-fundecodes-digital-cedl.vercel.app',
    'http://localhost:3000',
    'http://localhost:5173',
  ];

  const frontendUrl = env('FRONTEND_URL').replace(/\/$/, '');
  const extra = parseCsv(env('CORS_ALLOWED_ORIGINS'));
  const set = new Set<string>([...defaults, ...extra]);

  if (frontendUrl) set.add(frontendUrl);

  return set;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Prefijo global
  app.setGlobalPrefix('api');

  // Archivos estáticos
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // Límite del body
  app.use(json({ limit: '10mb' }));
  app.use(urlencoded({ extended: true, limit: '10mb' }));

  // ===== CORS =====
  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const ALLOW_LOCALHOST = true;
  const ALLOWED = buildAllowedOrigins();

  app.enableCors({
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
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
    origin: (origin, callback) => {
      // Permitir requests sin origin
      if (!origin) return callback(null, true);

      // Permitir el frontend principal
      if (origin === FRONTEND_URL) return callback(null, true);

      // Permitir orígenes de la lista blanca
      if (ALLOWED.has(origin)) return callback(null, true);

      // Permitir subdominios de Render
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith('.onrender.com')) {
          return callback(null, true);
        }
      } catch {
        // ignorar errores de parseo
      }

      // Permitir localhost en desarrollo
      if (ALLOW_LOCALHOST && /^http:\/\/localhost:\d+$/i.test(origin)) {
        return callback(null, true);
      }

      // Bloquear sin lanzar error
      return callback(null, false);
    },
  });

  // ===== Pipes globales =====
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // ===== Filtros globales =====
  app.useGlobalFilters(new HttpExceptionFilter());

  // ===== Trust proxy =====
  if (process.env.TRUST_PROXY === '1' || process.env.RENDER) {
    app.set('trust proxy', 1);
  }

  // ===== Swagger =====
  const publicServer =
    process.env.PUBLIC_API_URL ||
    (process.env.RENDER_EXTERNAL_URL
      ? `${process.env.RENDER_EXTERNAL_URL}/api`
      : 'http://localhost:4000/api');

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

  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
  });

  SwaggerModule.setup('docs', app, swaggerDoc, {
    swaggerOptions: {
      persistAuthorization: true,
      displayRequestDuration: true,
      tryItOutEnabled: true,
    },
    customSiteTitle: 'FUNDECODES API Docs',
  });

  // ===== Health básico =====
  const http = app.getHttpAdapter();

  http.get('/', (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      name: 'BackFundecodesDigital',
      docs: '/docs',
      api: '/api',
    });
  });

  http.head('/', (_req: any, res: any) => {
    res.status(200).end();
  });

  // ===== Prisma =====
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  // ===== Listen =====
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API:      http://localhost:${port}/api`);
  console.log(`📘 Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS base: ${FRONTEND_URL}`);
  const extras = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
  if (extras.length) {
    console.log(`🌍 Extra:    ${extras.join(', ')}`);
  }
  console.log('============================================================');
}

bootstrap();
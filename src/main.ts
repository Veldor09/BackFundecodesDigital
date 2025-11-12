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
    // Swagger corriendo en el mismo servicio Render
    'https://backfundecodesdigital.onrender.com',
    // Tu front en Vercel (ajústalo si cambias de dominio)
    'https://front-fundecodes-digital-cedl.vercel.app',
    // Localhost comunes
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

  // Prefijo global (toda tu API vive en /api)
  app.setGlobalPrefix('api');

  // Archivos estáticos (si los usas)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // Body size
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
      // Peticiones sin origin (curl, health checks, SSR interno) → permitir
      if (!origin) return callback(null, true);

      // Coincide FRONTEND_URL
      if (origin === FRONTEND_URL) return callback(null, true);

      // Lista blanca declarada (CORS_ALLOWED_ORIGINS y defaults)
      if (ALLOWED.has(origin)) return callback(null, true);

      // Permitir subdominios de Render (*.onrender.com) — útil para previews
      try {
        const host = new URL(origin).hostname;
        if (host.endsWith('.onrender.com')) {
          return callback(null, true);
        }
      } catch {
        // ignorar errores de parseo
      }

      // Permitir localhost:* si está activado
      if (ALLOW_LOCALHOST && /^http:\/\/localhost:\d+$/i.test(origin)) {
        return callback(null, true);
      }

      // ❌ No permitido: NO lanzar error (evita 500). Solo deshabilita CORS.
      return callback(null, false);
    },
  });

  // Pipes y filtros
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());

  // Trust proxy (Render/NGINX)
  if (process.env.TRUST_PROXY === '1' || process.env.RENDER) {
    app.set('trust proxy', 1);
  }

  // ===== Swagger =====
  const publicServer =
    process.env.PUBLIC_API_URL ||
    (process.env.RENDER_EXTERNAL_URL ? `${process.env.RENDER_EXTERNAL_URL}/api` : 'http://localhost:4000/api');

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

  // Handlers mínimos para `/` (GET/HEAD) => evitan 404 en Render
  const http = app.getHttpAdapter();
  http.get('/', (_req: any, res: any) => {
    res.status(200).json({ ok: true, name: 'BackFundecodesDigital', docs: '/docs', api: '/api' });
  });
  http.head('/', (_req: any, res: any) => res.status(200).end());

  // Prisma
  const prisma = app.get(PrismaService);
  await prisma.enableShutdownHooks(app);

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);

  console.log('============================================================');
  console.log(`🚀 API:      http://localhost:${port}/api`);
  console.log(`📘 Swagger:  http://localhost:${port}/docs`);
  console.log(`🌍 CORS base: ${FRONTEND_URL}`);
  const extras = parseCsv(process.env.CORS_ALLOWED_ORIGINS);
  if (extras.length) console.log(`🌍 Extra:    ${extras.join(', ')}`);
  console.log('============================================================');
}

bootstrap();
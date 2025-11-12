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
    .map(s => s.trim())
    .filter(Boolean);
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

  // CORS
  const FRONTEND_URL = (process.env.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  const EXTRA_ORIGINS = parseCsv(process.env.CORS_EXTRA_ORIGINS); // CSV opcional
  const ALLOW_LOCALHOST = true;

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // health checks / curl
      if (origin === FRONTEND_URL) return callback(null, true);
      if (EXTRA_ORIGINS.includes(origin)) return callback(null, true);
      if (ALLOW_LOCALHOST && /^http:\/\/localhost:\d+$/i.test(origin)) return callback(null, true);
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
  if (EXTRA_ORIGINS.length) console.log(`🌍 Extra:    ${EXTRA_ORIGINS.join(', ')}`);
  console.log('============================================================');
}

bootstrap();

// src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { PrismaService } from './prisma/prisma.service';
import { NestExpressApplication } from '@nestjs/platform-express';
import { json, urlencoded } from 'express';
import { join } from 'path';
import helmet from 'helmet';
import compression from 'compression';
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

/**
 * Construye la whitelist de orígenes permitidos para CORS.
 *
 * En producción ÚNICAMENTE confía en `FRONTEND_URL` y `CORS_ALLOWED_ORIGINS`
 * (ambos vienen del .env). En desarrollo permite localhost por comodidad.
 */
function buildAllowedOrigins(isProd: boolean): Set<string> {
  const frontendUrl = env('FRONTEND_URL').replace(/\/$/, '');
  const publicFrontend = env('PUBLIC_FRONTEND_URL').replace(/\/$/, '');
  const extra = parseCsv(env('CORS_ALLOWED_ORIGINS')).map((o) =>
    o.replace(/\/$/, ''),
  );

  const set = new Set<string>();
  if (frontendUrl) set.add(frontendUrl);
  if (publicFrontend) set.add(publicFrontend);
  extra.forEach((o) => set.add(o));

  if (!isProd) {
    set.add('http://localhost:3000');
    set.add('http://localhost:5173');
  }

  return set;
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
    bodyParser: false, // gestionamos nosotros abajo con límites explícitos
  });

  const log = new Logger('Bootstrap');
  const isProd = process.env.NODE_ENV === 'production';

  // ===== Trust proxy (obligatorio detrás de Nginx) =====
  if (env('TRUST_PROXY') === '1' || isProd) {
    app.set('trust proxy', 1);
  }

  // ===== Hardening HTTP =====
  app.use(
    helmet({
      // Desactivamos COEP/CORP estrictos para no bloquear uploads cross-origin
      crossOriginEmbedderPolicy: false,
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false, // la CSP la controla el frontend/proxy
    }),
  );

  // ===== Compresión gzip =====
  app.use(compression());

  // ===== Body limits =====
  const bodyLimit = env('BODY_LIMIT', '10mb');
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  // ===== Prefijo global =====
  app.setGlobalPrefix('api');

  // ===== Archivos estáticos (uploads) =====
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
    setHeaders: (res) => {
      // Evitamos caches agresivos para documentos administrativos
      res.setHeader('Cache-Control', 'private, max-age=300');
    },
  });

  // ===== CORS =====
  const ALLOWED = buildAllowedOrigins(isProd);
  log.log(`CORS whitelist: ${Array.from(ALLOWED).join(', ') || '(vacío)'}`);

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
    exposedHeaders: ['ETag', 'Content-Disposition'],
    maxAge: 600, // cachear preflight 10 min
    preflightContinue: false,
    optionsSuccessStatus: 204,
    origin: (origin, callback) => {
      // Llamadas server-to-server / curl / misma-origen
      if (!origin) return callback(null, true);

      // Whitelist explícita
      if (ALLOWED.has(origin.replace(/\/$/, ''))) {
        return callback(null, true);
      }

      // En dev permitimos cualquier localhost
      if (!isProd && /^https?:\/\/localhost(:\d+)?$/i.test(origin)) {
        return callback(null, true);
      }

      log.warn(`CORS bloqueado: ${origin}`);
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

  // ===== Swagger (solo si está habilitado) =====
  if (env('ENABLE_SWAGGER', isProd ? 'false' : 'true') === 'true') {
    const publicServer =
      env('PUBLIC_API_URL') ||
      (env('RENDER_EXTERNAL_URL')
        ? `${env('RENDER_EXTERNAL_URL')}/api`
        : `http://localhost:${env('PORT', '4000')}/api`);

    const swaggerConfig = new DocumentBuilder()
      .setTitle('FUNDECODES API')
      .setDescription(
        'API pública y de administración del sistema FUNDECODES.',
      )
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          name: 'Authorization',
          description: 'Token JWT (con o sin el prefijo "Bearer ").',
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
  }

  // ===== Health básico =====
  const http = app.getHttpAdapter();
  http.get('/', (_req: any, res: any) => {
    res.status(200).json({
      ok: true,
      name: 'BackFundecodesDigital',
      docs: isProd ? 'disabled' : '/docs',
      api: '/api',
    });
  });
  http.head('/', (_req: any, res: any) => res.status(200).end());
  http.get('/healthz', (_req: any, res: any) =>
    res.status(200).json({ ok: true, uptime: process.uptime() }),
  );

  // ===== Prisma shutdown hooks (Prisma >=5 lo gestiona interno, mantenido por compat) =====
  const prisma = app.get(PrismaService);
  if (typeof (prisma as any).enableShutdownHooks === 'function') {
    await (prisma as any).enableShutdownHooks(app);
  }

  // ===== Listen =====
  const port = Number(env('PORT', '4000'));
  await app.listen(port, '0.0.0.0');

  log.log(`🚀 API en http://localhost:${port}/api`);
  log.log(`📦 NODE_ENV=${process.env.NODE_ENV ?? '(unset)'}`);
}

bootstrap().catch((err) => {
  // Cualquier error en arranque es fatal
  // eslint-disable-next-line no-console
  console.error('[BOOTSTRAP FATAL]', err);
  process.exit(1);
});

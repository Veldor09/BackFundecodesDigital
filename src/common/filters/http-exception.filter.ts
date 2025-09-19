// src/common/filters/http-exception.filter.ts
import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

type PrismaKnownError = {
  code: string; // P2002, P2025, P2003, etc.
  meta?: Record<string, any>;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isDev = (process.env.NODE_ENV || 'development') !== 'production';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'INTERNAL_SERVER_ERROR';
    let errors: any = undefined; // lista de errores (p. ej., ValidationPipe)
    let extra: Record<string, any> | undefined;

    // ── 1) HttpException (incluye ValidationPipe) ───────────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();

      if (typeof resp === 'string') {
        message = resp;
      } else if (resp && typeof resp === 'object') {
        const r: any = resp;
        if (Array.isArray(r.message)) {
          // ValidationPipe
          errors = r.message;
          message = 'Validación fallida';
          error = r.error ?? 'BAD_REQUEST';
          status = HttpStatus.BAD_REQUEST;
        } else {
          message = r.message ?? message;
          error = r.error ?? error;
          if (isDev) extra = { ...extra, httpResponse: r };
        }
      }

      // Normaliza nombres comunes
      if (status === HttpStatus.UNAUTHORIZED && error === 'INTERNAL_SERVER_ERROR') {
        error = 'UNAUTHORIZED';
      }
      if (status === HttpStatus.FORBIDDEN && error === 'INTERNAL_SERVER_ERROR') {
        error = 'FORBIDDEN';
      }
    }

    // ── 2) Prisma Known Errors (P2002, P2025, P2003) ────────────────────────────
    const maybePrisma: any = exception as any;
    if (maybePrisma?.code && typeof maybePrisma.code === 'string') {
      const prismaErr: PrismaKnownError = {
        code: maybePrisma.code,
        meta: maybePrisma.meta,
      };

      if (isDev) {
        extra = { ...extra, prisma: { code: prismaErr.code, meta: prismaErr.meta } };
      }

      switch (prismaErr.code) {
        case 'P2002': {
          status = HttpStatus.CONFLICT;
          error = 'CONFLICT';
          const target = Array.isArray(prismaErr.meta?.target)
            ? prismaErr.meta.target.join(', ')
            : prismaErr.meta?.target || 'campo único';
          message = `Conflicto de unicidad en: ${target}`;
          break;
        }
        case 'P2025': {
          status = HttpStatus.NOT_FOUND;
          error = 'NOT_FOUND';
          message = 'Recurso no encontrado';
          break;
        }
        case 'P2003': {
          status = HttpStatus.CONFLICT;
          error = 'CONFLICT';
          message = 'Conflicto de integridad referencial';
          break;
        }
        default: {
          error = `PRISMA_${prismaErr.code}`;
          message = 'Error de base de datos';
        }
      }
    }

    // ── 3) BadRequest manual (por ejemplo, checks propios) ─────────────────────
    if (exception instanceof BadRequestException && !errors) {
      const response = exception.getResponse() as any;
      const maybeArray = response?.message;
      if (Array.isArray(maybeArray)) errors = maybeArray;
      status = HttpStatus.BAD_REQUEST;
      error = 'BAD_REQUEST';
      message = response?.message ?? 'Solicitud inválida';
      if (isDev) extra = { ...extra, badRequestResponse: response };
    }

    // ── LOG SIEMPRE EN CONSOLA ─────────────────────────────────────────────────
    // eslint-disable-next-line no-console
    console.error('[EXCEPTION]', {
      name: (exception as any)?.name,
      message: (exception as any)?.message,
      stack: (exception as any)?.stack,
      status,
      path: req.originalUrl,
      method: req.method,
      // En dev mostramos más detalle del objeto
      raw: isDev ? exception : undefined,
    });

    // ── Payload base ────────────────────────────────────────────────────────────
    const payload: Record<string, any> = {
      success: false,
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString(),
    };

    if (errors) payload.errors = errors;
    if (isDev) {
      // Agrega stack y extras útiles SOLO en dev
      payload.stack = (exception as any)?.stack;
      if (extra) payload.debug = extra;
    }

    return res.status(status).json(payload);
  }
}

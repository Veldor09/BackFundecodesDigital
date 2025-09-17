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
  code: string; // e.g. 'P2002', 'P2025', 'P2003'
  meta?: Record<string, any>;
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Error interno del servidor';
    let error = 'INTERNAL_SERVER_ERROR';
    let errors: any = undefined; // detalles (por ejemplo validación)

    // ── 1) HttpException (incluye ValidationPipe) ───────────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();

      const response: any = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        // Nest suele poner aquí { statusCode, message, error }
        if (Array.isArray(response.message)) {
          // ValidationPipe => lista de errores
          errors = response.message;
          message = 'Validación fallida';
          error = response.error ?? 'BAD_REQUEST';
          status = HttpStatus.BAD_REQUEST;
        } else {
          message = response.message ?? message;
          error = response.error ?? error;
        }
      }

      // Normaliza nombres de error 401/403
      if (
        status === HttpStatus.UNAUTHORIZED &&
        error === 'INTERNAL_SERVER_ERROR'
      )
        error = 'UNAUTHORIZED';
      if (status === HttpStatus.FORBIDDEN && error === 'INTERNAL_SERVER_ERROR')
        error = 'FORBIDDEN';
    }

    // ── 2) Prisma Known Errors (P2002, P2025, P2003) ────────────────────────────
    const maybePrisma: any = exception as any;
    if (maybePrisma?.code && typeof maybePrisma.code === 'string') {
      const prismaErr: PrismaKnownError = {
        code: maybePrisma.code,
        meta: maybePrisma.meta,
      };

      switch (prismaErr.code) {
        case 'P2002': {
          // Unique constraint failed
          status = HttpStatus.CONFLICT;
          error = 'CONFLICT';
          const target = Array.isArray(prismaErr.meta?.target)
            ? prismaErr.meta.target.join(', ')
            : 'campo único';
          message = `Conflicto de unicidad en: ${target}`;
          break;
        }
        case 'P2025': {
          // Record not found
          status = HttpStatus.NOT_FOUND;
          error = 'NOT_FOUND';
          message = 'Recurso no encontrado';
          break;
        }
        case 'P2003': {
          // Foreign key constraint failed
          status = HttpStatus.CONFLICT;
          error = 'CONFLICT';
          message = 'Conflicto de integridad referencial';
          break;
        }
        default: {
          // Otros códigos: mantiene 500 por defecto, pero expone el code
          error = `PRISMA_${prismaErr.code}`;
          message = 'Error de base de datos';
        }
      }
    }

    // ── 3) BadRequest manual (por ejemplo, fecha inválida / edad mínima) ────────
    if (exception instanceof BadRequestException && !errors) {
      const response = exception.getResponse() as any;
      const maybeArray = response?.message;
      if (Array.isArray(maybeArray)) errors = maybeArray;
      status = HttpStatus.BAD_REQUEST;
      error = 'BAD_REQUEST';
      message = response?.message ?? 'Solicitud inválida';
    }

    const payload: Record<string, any> = {
      success: false,
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    };
    if (errors) payload.errors = errors;

    res.status(status).json(payload);
  }
}

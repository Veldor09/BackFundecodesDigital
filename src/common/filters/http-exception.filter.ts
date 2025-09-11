import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: any = 'Error interno del servidor';
    let error = 'INTERNAL_SERVER_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response: any = exception.getResponse();
      if (typeof response === 'string') {
        message = response;
      } else if (response && typeof response === 'object') {
        message = response.message ?? message;
        error = response.error ?? error;
      }
      if (status === HttpStatus.UNAUTHORIZED && error === 'INTERNAL_SERVER_ERROR') error = 'UNAUTHORIZED';
      if (status === HttpStatus.FORBIDDEN && error === 'INTERNAL_SERVER_ERROR') error = 'FORBIDDEN';
    }

    res.status(status).json({
      success: false,
      statusCode: status,
      error,
      message,
      path: req.originalUrl,
      timestamp: new Date().toISOString(),
    });
  }
}

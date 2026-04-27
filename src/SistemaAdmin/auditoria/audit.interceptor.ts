// src/SistemaAdmin/auditoria/audit.interceptor.ts
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, tap } from 'rxjs';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';
import { AuditoriaService } from './auditoria.service';

/**
 * Interceptor global. Cuando un endpoint tiene `@Audit({...})`, registra
 * el evento en la tabla `Auditoria` después de que la respuesta se haya
 * resuelto con éxito (los errores no se auditan: la transacción no ocurrió).
 *
 * El registro es asincrónico y a prueba de fallos: si la auditoría falla,
 * NO afecta la respuesta del endpoint.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditoria: AuditoriaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.get<AuditMetadata>(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    );

    if (!meta) return next.handle();

    const req = context.switchToHttp().getRequest();
    const user = req.user ?? {};
    const params = req.params ?? {};
    const body = sanitize(req.body ?? {});
    const ip = (req.ip as string | undefined) ?? null;
    const userAgent = (req.headers?.['user-agent'] as string | undefined) ?? null;

    return next.handle().pipe(
      tap((result: unknown) => {
        // El registro es fire-and-forget: no esperamos.
        void this.tryRegistrar(meta, { user, params, body, result, ip, userAgent });
      }),
    );
  }

  private async tryRegistrar(
    meta: AuditMetadata,
    ctx: {
      user: any;
      params: any;
      body: any;
      result: unknown;
      ip: string | null;
      userAgent: string | null;
    },
  ) {
    try {
      const entidadId =
        meta.resolveEntidadId?.({
          params: ctx.params,
          body: ctx.body,
          result: ctx.result,
        }) ??
        ctx.params?.id ??
        (ctx.result as any)?.id ??
        null;

      const detalle =
        meta.resolveDetalle?.({
          params: ctx.params,
          body: ctx.body,
          result: ctx.result,
          user: ctx.user,
        }) ?? null;

      const metadata =
        meta.resolveMetadata?.({
          params: ctx.params,
          body: ctx.body,
          result: ctx.result,
        }) ??
        ({ params: ctx.params, body: ctx.body } as Record<string, unknown>);

      await this.auditoria.registrar({
        userId: ctx.user?.userId ?? ctx.user?.id ?? null,
        userEmail: ctx.user?.email ?? null,
        userName: ctx.user?.name ?? null,
        accion: meta.accion,
        entidad: meta.entidad ?? null,
        entidadId,
        detalle,
        metadata,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    } catch (err) {
      this.logger.warn(
        `Auditoría omitida por error interno (${meta.accion}): ${(err as Error).message}`,
      );
    }
  }
}

/**
 * Quita campos sensibles de objetos antes de loguearlos.
 * No se modifica el original.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'pass',
  'currentPassword',
  'newPassword',
  'confirmPassword',
  'token',
  'accessToken',
  'refreshToken',
  'authorization',
  'secret',
]);

function sanitize(value: unknown): unknown {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map((v) => sanitize(v));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k)) {
        out[k] = '[REDACTED]';
      } else {
        out[k] = sanitize(v);
      }
    }
    return out;
  }
  return value;
}

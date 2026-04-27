// src/SistemaAdmin/auditoria/audit.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const AUDIT_METADATA_KEY = 'audit:metadata';

export type AuditMetadata = {
  /** Acción legible: "SOLICITUD_CREAR", "PROYECTO_EDITAR". */
  accion: string;
  /** Tipo de entidad afectada: "Solicitud", "Proyecto", ... */
  entidad?: string;
  /**
   * Cómo extraer el ID del recurso. Por defecto se intenta `params.id`
   * y, si no, el `id` del response. Para casos especiales, pasar una fn.
   */
  resolveEntidadId?: (ctx: { params: any; body: any; result: any }) => string | number | null | undefined;
  /**
   * Resumen humano. Se llama tras la respuesta.
   * Devolver `null` salta el registro (caso "el endpoint falló silencioso").
   */
  resolveDetalle?: (ctx: { params: any; body: any; result: any; user: any }) => string | null;
  /**
   * Extra metadata como JSON (estado anterior/nuevo, etc.).
   * Por defecto se incluye `{ params, body }` saneados.
   *
   * El contenido debe ser JSON-serializable (Prisma lo persiste en una
   * columna JSONB). Devuelve `null` para no guardar nada.
   */
  resolveMetadata?: (ctx: {
    params: any;
    body: any;
    result: any;
  }) => Record<string, unknown> | unknown[] | null;
};

/**
 * Marca un endpoint para que el AuditInterceptor lo registre tras ejecutarse
 * con éxito. Ejemplo:
 *
 *   @Audit({ accion: 'SOLICITUD_CREAR', entidad: 'Solicitud' })
 *   @Post()
 *   create(...) { ... }
 */
export const Audit = (meta: AuditMetadata) =>
  SetMetadata(AUDIT_METADATA_KEY, meta);

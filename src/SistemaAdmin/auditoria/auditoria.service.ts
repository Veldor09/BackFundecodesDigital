// src/SistemaAdmin/auditoria/auditoria.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Forma "permisiva" de un payload JSON-serializable para metadata.
 * Aceptamos `unknown` en hojas porque los callers (decorator @Audit,
 * resolveMetadata, etc.) no pueden saber el tipo exacto, y nosotros
 * confiamos en que el contenido es serializable a JSON (el interceptor
 * ya lo sanea de passwords/tokens). Convertimos al tipo estricto de
 * Prisma con un cast en el momento de persistir.
 */
export type AuditMetadataPayload =
  | Record<string, unknown>
  | unknown[]
  | null;

export type RegistrarAuditoriaInput = {
  userId?: number | null;
  userEmail?: string | null;
  userName?: string | null;
  accion: string;
  entidad?: string | null;
  entidadId?: string | number | null;
  detalle?: string | null;
  metadata?: AuditMetadataPayload;
  ip?: string | null;
  userAgent?: string | null;
};

export type ListAuditoriaQuery = {
  page?: number;
  pageSize?: number;
  userId?: number;
  accion?: string;
  entidad?: string;
  entidadId?: string;
  desde?: string; // ISO date
  hasta?: string;
  q?: string; // búsqueda libre en accion/detalle/userEmail
};

@Injectable()
export class AuditoriaService {
  private readonly logger = new Logger(AuditoriaService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento de auditoría. Es "fire-and-forget": cualquier error
   * se logea pero NUNCA propaga al caller — la auditoría jamás debe romper
   * el flujo del negocio.
   */
  async registrar(input: RegistrarAuditoriaInput): Promise<void> {
    try {
      await this.prisma.auditoria.create({
        data: {
          userId: input.userId ?? null,
          userEmail: input.userEmail ?? null,
          userName: input.userName ?? null,
          accion: input.accion,
          entidad: input.entidad ?? null,
          entidadId:
            input.entidadId === null || input.entidadId === undefined
              ? null
              : String(input.entidadId),
          detalle: input.detalle ?? null,
          // Cast seguro: el contenido viene saneado por el interceptor y los
          // callers solo pasan estructuras JSON-compatibles. Prisma lo
          // serializa con JSON.stringify al insertar.
          metadata:
            input.metadata == null
              ? Prisma.JsonNull
              : (input.metadata as Prisma.InputJsonValue),
          ip: input.ip ?? null,
          userAgent: input.userAgent ?? null,
        },
      });
    } catch (err) {
      this.logger.error(
        `Fallo al registrar auditoría (${input.accion}): ${(err as Error).message}`,
      );
    }
  }

  async findAll(query: ListAuditoriaQuery = {}) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(200, Math.max(1, Number(query.pageSize ?? 50)));
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditoriaWhereInput = {};
    if (query.userId) where.userId = Number(query.userId);
    if (query.accion) where.accion = query.accion;
    if (query.entidad) where.entidad = query.entidad;
    if (query.entidadId) where.entidadId = String(query.entidadId);

    if (query.desde || query.hasta) {
      where.createdAt = {};
      if (query.desde) (where.createdAt as Prisma.DateTimeFilter).gte = new Date(query.desde);
      if (query.hasta) (where.createdAt as Prisma.DateTimeFilter).lte = new Date(query.hasta);
    }

    if (query.q) {
      where.OR = [
        { accion: { contains: query.q, mode: 'insensitive' } },
        { detalle: { contains: query.q, mode: 'insensitive' } },
        { userEmail: { contains: query.q, mode: 'insensitive' } },
        { userName: { contains: query.q, mode: 'insensitive' } },
        { entidad: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.auditoria.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      }),
      this.prisma.auditoria.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

// src/SistemaAdmin/solicitudes/solicitudes.service.ts
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudDto, TipoOrigenSolicitudDto } from './dto/create-solicitud.dto';
import { EmailService } from '../../common/services/email.service';
import { AuditoriaService } from '../auditoria/auditoria.service';

/** Datos comunes incluidos al devolver una solicitud al cliente. */
const SOLICITUD_INCLUDE = {
  usuario: { select: { id: true, name: true, email: true } },
  programa: { select: { id: true, nombre: true } },
  project: { select: { id: true, title: true, slug: true } },
  historial: { orderBy: { createdAt: 'desc' as const } },
} satisfies Prisma.SolicitudCompraInclude;

@Injectable()
export class SolicitudesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
    private readonly auditoria: AuditoriaService,
  ) {}

  // =====================================================
  // 🔹 CREAR SOLICITUD
  // =====================================================
  async create(
    dto: CreateSolicitudDto,
    archivos: string[],
    actor?: { userId?: number | null; email?: string | null; name?: string | null } | number,
  ) {
    // Compatibilidad: el caller puede pasar solo el id o el objeto user completo.
    const usuarioId =
      typeof actor === 'number' ? actor : actor?.userId ?? null;
    const userEmail = typeof actor === 'object' ? actor?.email ?? null : null;
    const userName = typeof actor === 'object' ? actor?.name ?? null : null;

    // Validar XOR de destino: exactamente uno de programaId / projectId.
    const { tipoOrigen, programaId, projectId } = dto;
    if (tipoOrigen === TipoOrigenSolicitudDto.PROGRAMA) {
      if (!programaId) {
        throw new BadRequestException(
          'tipoOrigen=PROGRAMA requiere programaId.',
        );
      }
      if (projectId) {
        throw new BadRequestException(
          'No se puede enviar projectId cuando tipoOrigen=PROGRAMA.',
        );
      }
    } else if (tipoOrigen === TipoOrigenSolicitudDto.PROYECTO) {
      if (!projectId) {
        throw new BadRequestException(
          'tipoOrigen=PROYECTO requiere projectId.',
        );
      }
      if (programaId) {
        throw new BadRequestException(
          'No se puede enviar programaId cuando tipoOrigen=PROYECTO.',
        );
      }
    }

    // Verificar que la entidad referenciada exista (mejor mensaje que un FK error).
    if (programaId) {
      const exists = await this.prisma.programaVoluntariado.findUnique({
        where: { id: programaId },
        select: { id: true },
      });
      if (!exists) throw new BadRequestException(`Programa #${programaId} no existe.`);
    }
    if (projectId) {
      const exists = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });
      if (!exists) throw new BadRequestException(`Proyecto #${projectId} no existe.`);
    }

    const created = await this.prisma.solicitudCompra.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        archivos,
        usuarioId: dto.usuarioId ?? usuarioId,
        monto: new Prisma.Decimal(dto.monto),
        tipoOrigen,
        programaId: programaId ?? null,
        projectId: projectId ?? null,
        estadoContadora: 'PENDIENTE',
        estadoDirector: 'PENDIENTE',
      },
      include: SOLICITUD_INCLUDE,
    });

    // Auditoría manual: el interceptor también podría hacerlo, pero acá tenemos
    // contexto rico (resumen humano legible) que vale la pena guardar.
    const destino =
      tipoOrigen === TipoOrigenSolicitudDto.PROGRAMA
        ? `programa "${created.programa?.nombre ?? programaId}"`
        : `proyecto "${created.project?.title ?? projectId}"`;
    await this.auditoria.registrar({
      userId: usuarioId ?? null,
      userEmail,
      userName,
      accion: 'SOLICITUD_CREAR',
      entidad: 'Solicitud',
      entidadId: created.id,
      detalle: `Creó solicitud #${created.id} "${created.titulo}" por ${this.fmtMonto(created.monto)} para ${destino}.`,
      metadata: {
        titulo: created.titulo,
        monto: created.monto?.toString() ?? null,
        tipoOrigen,
        programaId: programaId ?? null,
        projectId: projectId ?? null,
        archivos: archivos.length,
      },
    });

    return created;
  }

  // =====================================================
  // 🔹 LISTAR TODAS LAS SOLICITUDES
  // =====================================================
  async findAll() {
    return this.prisma.solicitudCompra.findMany({
      orderBy: { createdAt: 'desc' },
      include: SOLICITUD_INCLUDE,
    });
  }

  // =====================================================
  // 🔹 OBTENER SOLICITUD POR ID
  // =====================================================
  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
      include: SOLICITUD_INCLUDE,
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  // =====================================================
  // 🔹 ENVIAR CORREO AUTOMÁTICO DE CAMBIO DE ESTADO
  // =====================================================
  private async notificarCambioEstado(
    idSolicitud: number,
    rol: string,
    nuevoEstado: string,
    comentario?: string | null,
  ) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id: idSolicitud },
      include: { usuario: true },
    });

    if (!solicitud || !solicitud.usuario?.email) return;

    const { email, name } = solicitud.usuario;
    const mensaje = comentario
      ? `Comentario: ${comentario}`
      : `Sin comentarios adicionales.`;

    try {
      await this.emailService.sendMail({
        to: email,
        subject: `Actualización de solicitud #${solicitud.id}`,
        text: `Hola ${name ?? 'usuario'}, tu solicitud "${solicitud.titulo}" cambió de estado (${rol}) a ${nuevoEstado}. ${mensaje}`,
        html: `
          <div style="font-family:Arial, sans-serif; line-height:1.6">
            <p>Hola ${name ?? 'usuario'},</p>
            <p>Tu solicitud <b>"${solicitud.titulo}"</b> fue actualizada por el <b>${rol}</b>:</p>
            <p><b>Nuevo estado:</b> ${nuevoEstado}</p>
            <p>${mensaje}</p>
            <p>Saludos,<br/>Equipo FUNDECODES</p>
          </div>
        `,
      });
      console.log(`[MAIL] ✓ Notificación enviada a ${email}`);
    } catch (e) {
      console.error('[MAIL] ✗ Error al enviar correo:', e);
    }
  }

  // =====================================================
  // 🔹 VALIDACIÓN / RECHAZO POR CONTADORA
  // =====================================================
  async validarPorContadora(
    id: number,
    estadoContadora: 'VALIDADA' | 'PENDIENTE' | 'DEVUELTA',
    comentarioContadora: string | null,
    actor?: { userId?: number | null; email?: string | null; name?: string | null } | number | null,
  ) {
    const estadosPermitidos = ['VALIDADA', 'PENDIENTE', 'DEVUELTA'];
    if (!estadosPermitidos.includes(estadoContadora)) {
      throw new ForbiddenException(
        `Estado no permitido: ${estadoContadora}. Solo se permiten ${estadosPermitidos.join(', ')}`,
      );
    }

    const userId =
      typeof actor === 'number' ? actor : actor?.userId ?? null;
    const userEmail = typeof actor === 'object' ? actor?.email ?? null : null;
    const userName = typeof actor === 'object' ? actor?.name ?? null : null;

    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: { estadoContadora, comentarioContadora },
      include: SOLICITUD_INCLUDE,
    });

    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estadoContadora,
        estadoNuevo: estadoContadora,
        userId: userId ?? null,
      },
    });

    await this.auditoria.registrar({
      userId: userId ?? null,
      userEmail,
      userName,
      accion: `SOLICITUD_CONTADORA_${estadoContadora}`,
      entidad: 'Solicitud',
      entidadId: id,
      detalle: `Contadora ${estadoContadora.toLowerCase()} solicitud #${id} (${this.fmtMonto(updated.monto)}). ${
        comentarioContadora ? `Comentario: ${comentarioContadora}` : 'Sin comentarios.'
      }`,
      metadata: {
        estadoAnterior: solicitud.estadoContadora,
        estadoNuevo: estadoContadora,
        comentario: comentarioContadora ?? null,
      },
    });

    await this.notificarCambioEstado(id, 'contadora', estadoContadora, comentarioContadora);
    return updated;
  }

  // =====================================================
  // 🔹 APROBACIÓN / RECHAZO POR DIRECTOR
  // =====================================================
  async decisionDirector(
    id: number,
    estadoDirector: 'APROBADA' | 'RECHAZADA',
    comentarioDirector: string | null,
    actor?: { userId?: number | null; email?: string | null; name?: string | null } | number | null,
  ) {
    const estadosPermitidos = ['APROBADA', 'RECHAZADA'];
    if (!estadosPermitidos.includes(estadoDirector)) {
      throw new ForbiddenException(
        `Estado no permitido: ${estadoDirector}. Solo se permiten ${estadosPermitidos.join(', ')}`,
      );
    }

    const userId =
      typeof actor === 'number' ? actor : actor?.userId ?? null;
    const userEmail = typeof actor === 'object' ? actor?.email ?? null : null;
    const userName = typeof actor === 'object' ? actor?.name ?? null : null;

    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: { estadoDirector, comentarioDirector },
      include: SOLICITUD_INCLUDE,
    });

    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estadoDirector,
        estadoNuevo: estadoDirector,
        userId: userId ?? null,
      },
    });

    await this.auditoria.registrar({
      userId: userId ?? null,
      userEmail,
      userName,
      accion: `SOLICITUD_DIRECTOR_${estadoDirector}`,
      entidad: 'Solicitud',
      entidadId: id,
      detalle: `Director ${estadoDirector.toLowerCase()} solicitud #${id} (${this.fmtMonto(updated.monto)}). ${
        comentarioDirector ? `Comentario: ${comentarioDirector}` : 'Sin comentarios.'
      }`,
      metadata: {
        estadoAnterior: solicitud.estadoDirector,
        estadoNuevo: estadoDirector,
        comentario: comentarioDirector ?? null,
      },
    });

    await this.notificarCambioEstado(id, 'director', estadoDirector, comentarioDirector);
    return updated;
  }

  // =====================================================
  // 🔹 VER HISTORIAL
  // =====================================================
  async historial(id: number) {
    return this.prisma.solicitudHistorial.findMany({
      where: { solicitudId: id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ---------- helpers ----------
  private fmtMonto(m: Prisma.Decimal | null | undefined): string {
    if (m === null || m === undefined) return 'monto no especificado';
    try {
      const n = Number(m.toString());
      return new Intl.NumberFormat('es-CR', {
        style: 'currency',
        currency: 'CRC',
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `₡${m.toString()}`;
    }
  }
}

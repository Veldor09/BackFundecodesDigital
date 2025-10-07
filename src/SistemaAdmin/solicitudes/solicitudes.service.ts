// src/SistemaAdmin/solicitudes/solicitudes.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';
import { EmailService } from '../../common/services/email.service';

@Injectable()
export class SolicitudesService {
  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
  ) {}

  // =====================================================
  // 🔹 CREAR SOLICITUD
  // =====================================================
  async create(dto: CreateSolicitudDto, archivos: string[], usuarioId?: number) {
    return this.prisma.solicitudCompra.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        archivos,
        usuarioId: usuarioId ?? null,
        estadoContadora: 'PENDIENTE',
        estadoDirector: 'PENDIENTE',
      },
    });
  }

  // =====================================================
  // 🔹 LISTAR TODAS LAS SOLICITUDES
  // =====================================================
  async findAll() {
    return this.prisma.solicitudCompra.findMany({
      orderBy: { createdAt: 'desc' },
      include: { historial: true },
    });
  }

  // =====================================================
  // 🔹 OBTENER SOLICITUD POR ID
  // =====================================================
  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
      include: { historial: true },
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
    estadoContadora: 'VALIDADA' | 'NO_VALIDADA' | 'RECHAZADA',
    comentarioContadora: string | null,
    userId?: number | null,
  ) {
    const estadosPermitidos = ['VALIDADA', 'NO_VALIDADA', 'RECHAZADA'];
    if (!estadosPermitidos.includes(estadoContadora)) {
      throw new ForbiddenException(
        `Estado no permitido: ${estadoContadora}. Solo se permiten ${estadosPermitidos.join(', ')}`,
      );
    }

    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: {
        estadoContadora,
        comentarioContadora,
      },
    });

    // Registrar en historial
    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estadoContadora,
        estadoNuevo: estadoContadora,
        userId: userId ?? null,
      },
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        userId: userId ?? null,
        accion: `CONTADORA_${estadoContadora}`,
        detalle: `Solicitud #${id} ${estadoContadora.toLowerCase()} por contadora. Comentario: ${
          comentarioContadora ?? '—'
        }`,
      },
    });

    // Notificación por correo
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
    userId?: number | null,
  ) {
    const estadosPermitidos = ['APROBADA', 'RECHAZADA'];
    if (!estadosPermitidos.includes(estadoDirector)) {
      throw new ForbiddenException(
        `Estado no permitido: ${estadoDirector}. Solo se permiten ${estadosPermitidos.join(', ')}`,
      );
    }

    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: {
        estadoDirector,
        comentarioDirector,
      },
    });

    // Historial
    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estadoDirector,
        estadoNuevo: estadoDirector,
        userId: userId ?? null,
      },
    });

    // Auditoría
    await this.prisma.auditoria.create({
      data: {
        userId: userId ?? null,
        accion: `DIRECTOR_${estadoDirector}`,
        detalle: `Solicitud #${id} ${estadoDirector.toLowerCase()} por director. Comentario: ${
          comentarioDirector ?? '—'
        }`,
      },
    });

    // Correo
    await this.notificarCambioEstado(id, 'director', estadoDirector, comentarioDirector);
    return updated;
  }

  // =====================================================
  // 🔹 VER HISTORIAL
  // =====================================================
  async historial(id: number) {
    return this.prisma.solicitudHistorial.findMany({
      where: { solicitudId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
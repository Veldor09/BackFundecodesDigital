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

  // ---------------- CREAR ----------------
  async create(dto: CreateSolicitudDto, archivos: string[], usuarioId?: number) {
    return this.prisma.solicitudCompra.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        archivos,
        usuarioId: usuarioId ?? null,
        estado: 'PENDIENTE',
      },
    });
  }

  // ---------------- LISTAR ----------------
  async findAll() {
    return this.prisma.solicitudCompra.findMany({
      orderBy: { createdAt: 'desc' },
      include: { historial: true },
    });
  }

  // ---------------- BUSCAR POR ID ----------------
  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
      include: { historial: true },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  // ---------------- NOTIFICAR POR CORREO ----------------
  // ---------------- NOTIFICAR POR CORREO ----------------
private async notificarCambioEstado(
  idSolicitud: number,
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
      text: `Hola ${name ?? 'usuario'}, tu solicitud "${solicitud.titulo}" cambió de estado a ${nuevoEstado}. ${mensaje}`,
      html: `
        <div style="font-family:Arial, sans-serif; line-height:1.6">
          <p>Hola ${name ?? 'usuario'},</p>
          <p>Tu solicitud <b>"${solicitud.titulo}"</b> cambió de estado a:</p>
          <p><b>${nuevoEstado}</b></p>
          <p>${mensaje}</p>
          <p>Saludos,<br/>Equipo FUNDECODES</p>
        </div>
      `,
    });
    console.log(`[MAIL] Notificación enviada a ${email}`);
  } catch (e) {
    console.error('[MAIL] Error al enviar correo:', e);
  }
}


  // ---------------- CAMBIAR ESTADO GENERAL ----------------
  async updateEstado(
    id: number,
    estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'VALIDADA',
    userId?: number | null,
  ) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: { estado },
    });

    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estado,
        estadoNuevo: estado,
        userId: userId ?? null,
      },
    });

    await this.notificarCambioEstado(id, estado);
    return updated;
  }

  // ---------------- VALIDAR POR CONTADORA ----------------
  async validarPorContadora(
    id: number,
    comentarioContadora: string | null,
    userId?: number | null,
  ) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: {
        estado: 'VALIDADA',
        comentarioContadora,
      },
    });

    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estado,
        estadoNuevo: 'VALIDADA',
        userId: userId ?? null,
      },
    });

    await this.prisma.auditoria.create({
      data: {
        userId: userId ?? null,
        accion: 'VALIDAR_SOLICITUD',
        detalle: `Solicitud #${id} validada por contadora. Comentario: ${comentarioContadora ?? '—'}`,
      },
    });

    await this.notificarCambioEstado(id, 'VALIDADA', comentarioContadora);
    return updated;
  }

  // ---------------- APROBACIÓN/RECHAZO POR DIRECTOR ----------------
  async decisionDirector(
    id: number,
    estado: 'APROBADA' | 'RECHAZADA',
    comentarioDirector: string | null,
    userId?: number | null,
  ) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    if (estado !== 'APROBADA' && estado !== 'RECHAZADA') {
      throw new ForbiddenException('El director solo puede aprobar o rechazar');
    }

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: {
        estado,
        comentarioDirector,
      },
    });

    await this.prisma.solicitudHistorial.create({
      data: {
        solicitudId: id,
        estadoAnterior: solicitud.estado,
        estadoNuevo: estado,
        userId: userId ?? null,
      },
    });

    await this.prisma.auditoria.create({
      data: {
        userId: userId ?? null,
        accion: `DIRECTOR_${estado}`,
        detalle: `Solicitud #${id} ${estado.toLowerCase()} por director. Comentario: ${comentarioDirector ?? '—'}`,
      },
    });

    await this.notificarCambioEstado(id, estado, comentarioDirector);
    return updated;
  }

  // ---------------- VER HISTORIAL ----------------
  async historial(id: number) {
    return this.prisma.solicitudHistorial.findMany({
      where: { solicitudId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

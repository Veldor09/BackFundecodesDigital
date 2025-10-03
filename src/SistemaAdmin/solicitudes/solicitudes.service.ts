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

  async findAll() {
    return this.prisma.solicitudCompra.findMany({
      orderBy: { createdAt: 'desc' },
      include: { historial: true },
    });
  }

  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
      include: { historial: true },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  private async notificarCambioEstado(idSolicitud: number, nuevoEstado: string) {
  console.log('[MAIL] notificarCambioEstado id:', idSolicitud, 'estado:', nuevoEstado);

  const solicitud = await this.prisma.solicitudCompra.findUnique({
    where: { id: idSolicitud },
    include: { usuario: true },
  });

  console.log('[MAIL] solicitud:', solicitud);
  if (!solicitud) { console.log('[MAIL] sin solicitud'); return; }
  if (!solicitud.usuario) { console.log('[MAIL] sin usuario'); return; }
  if (!solicitud.usuario.email) { console.log('[MAIL] email vacío'); return; }

  const { email, name } = solicitud.usuario;
  console.log('[MAIL] enviando a:', email);

  try {
    await this.emailService.sendMail({
      to: email,
      subject: `Tu solicitud #${solicitud.id} ha cambiado de estado`,
      text: `Hola ${name ?? 'Usuario'},\nEl estado de tu solicitud "${solicitud.titulo}" ahora es: ${nuevoEstado}.`,
    });
    console.log('[MAIL] ✓ sendMail ejecutado');
  } catch (e) {
    console.error('[MAIL] ✗ Error al enviar:', e);
  }
}

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

  async validarPorContadora(id: number, userId?: number | null) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: { estado: 'VALIDADA' },
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
        detalle: `Solicitud #${id} validada por contadora`,
      },
    });

    await this.notificarCambioEstado(id, 'VALIDADA');
    return updated;
  }

  async decisionDirector(
    id: number,
    estado: 'APROBADA' | 'RECHAZADA',
    comentario: string | null,
    userId?: number | null,
  ) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({ where: { id } });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');

    if (estado !== 'APROBADA' && estado !== 'RECHAZADA') {
      throw new ForbiddenException('El director solo puede aprobar o rechazar');
    }

    const updated = await this.prisma.solicitudCompra.update({
      where: { id },
      data: { estado, comentario },
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
        detalle: `Solicitud #${id} ${estado.toLowerCase()} por director. Comentario: ${comentario ?? '—'}`,
      },
    });

    await this.notificarCambioEstado(id, estado);
    return updated;
  }

  async historial(id: number) {
    return this.prisma.solicitudHistorial.findMany({
      where: { solicitudId: id },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}
// src/SistemaAdmin/solicitudes/solicitudes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

@Injectable()
export class SolicitudesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSolicitudDto, archivos: string[], usuarioId?: number) {
    return this.prisma.solicitudCompra.create({
      data: {
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        archivos,
        usuarioId,
      },
    });
  }

  async findAll() {
    return this.prisma.solicitudCompra.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id },
    });
    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    return solicitud;
  }

  async updateEstado(id: number, estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA') {
    return this.prisma.solicitudCompra.update({
      where: { id },
      data: { estado },
    });
  }
}

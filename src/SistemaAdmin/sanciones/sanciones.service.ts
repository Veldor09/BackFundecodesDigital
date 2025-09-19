import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateSancionDto } from './dto/create-sancion.dto';
import { UpdateSancionDto } from './dto/update-sancion.dto';
import { Prisma } from '@prisma/client';

function estadoCalculado(s: { fechaVencimiento: Date | null; fechaRevocacion: Date | null }): 'ACTIVA'|'EXPIRADA'|'REVOCADA' {
  if (s.fechaRevocacion) return 'REVOCADA';
  if (s.fechaVencimiento && s.fechaVencimiento.getTime() < Date.now()) return 'EXPIRADA';
  return 'ACTIVA';
}

@Injectable()
export class SancionesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateSancionDto) {
    const sancion = await this.prisma.sancion.create({
      data: {
        voluntarioId: dto.voluntarioId,
        tipo: dto.tipo as any,
        motivo: dto.motivo,
        descripcion: dto.descripcion ?? null,
        fechaInicio: new Date(dto.fechaInicio),
        fechaVencimiento: dto.fechaVencimiento ? new Date(dto.fechaVencimiento) : null,
        creadaPor: dto.creadaPor ?? null,
      },
      include: { voluntario: true },
    });

    // asegurar estado coherente
    const estado = estadoCalculado(sancion);
    if (estado !== sancion.estado) {
      return this.prisma.sancion.update({
        where: { id: sancion.id },
        data: { estado: estado as any },
        include: { voluntario: true },
      });
    }

    return sancion;
  }

  async findAll(params: {
    page?: number; limit?: number; search?: string; estado?: string; voluntarioId?: number;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const skip = (page - 1) * limit;

    const where: Prisma.SancionWhereInput = {};

    if (params.estado && ['ACTIVA','EXPIRADA','REVOCADA'].includes(params.estado)) {
      where.estado = params.estado as any;
    }
    if (params.voluntarioId) where.voluntarioId = params.voluntarioId;

    if (params.search) {
      where.OR = [
        { motivo: { contains: params.search, mode: 'insensitive' } },
        { descripcion: { contains: params.search, mode: 'insensitive' } },
        { voluntario: {
            OR: [
              { nombreCompleto: { contains: params.search, mode: 'insensitive' } },
              { numeroDocumento: { contains: params.search, mode: 'insensitive' } },
              { email: { contains: params.search, mode: 'insensitive' } },
            ]
        }},
      ];
    }

    // actualizar estados expirados “al vuelo”
    await this.prisma.sancion.updateMany({
      where: {
        estado: 'ACTIVA',
        fechaVencimiento: { lt: new Date() },
        fechaRevocacion: null,
      },
      data: { estado: 'EXPIRADA' },
    });

    const [total, data] = await this.prisma.$transaction([
      this.prisma.sancion.count({ where }),
      this.prisma.sancion.findMany({
        where,
        include: { voluntario: true },
        orderBy: [{ createdAt: 'desc' }],
        skip, take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async findOne(id: number) {
    const s = await this.prisma.sancion.findUnique({
      where: { id },
      include: { voluntario: true },
    });
    if (!s) throw new NotFoundException('Sanción no encontrada');
    return s;
  }

  async update(id: number, dto: UpdateSancionDto) {
    await this.findOne(id);
    const s = await this.prisma.sancion.update({
      where: { id },
      data: {
        voluntarioId: dto.voluntarioId,
        tipo: dto.tipo as any,
        motivo: dto.motivo,
        descripcion: dto.descripcion ?? null,
        fechaInicio: dto.fechaInicio ? new Date(dto.fechaInicio) : undefined,
        fechaVencimiento: dto.fechaVencimiento === null
          ? null
          : dto.fechaVencimiento
            ? new Date(dto.fechaVencimiento)
            : undefined,
        creadaPor: dto.creadaPor ?? undefined,
      },
      include: { voluntario: true },
    });

    const estado = estadoCalculado(s);
    if (estado !== s.estado) {
      return this.prisma.sancion.update({
        where: { id: s.id },
        data: { estado: estado as any },
        include: { voluntario: true },
      });
    }
    return s;
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.sancion.delete({ where: { id } });
    return { ok: true };
  }

  async revocar(id: number, revocadaPor?: string) {
    await this.findOne(id);
    return this.prisma.sancion.update({
      where: { id },
      data: {
        estado: 'REVOCADA',
        revocadaPor: revocadaPor ?? 'Sistema',
        fechaRevocacion: new Date(),
      },
      include: { voluntario: true },
    });
  }

  async activasPorVoluntario(voluntarioId: number) {
    // refrescar expiradas primero
    await this.prisma.sancion.updateMany({
      where: { estado: 'ACTIVA', fechaVencimiento: { lt: new Date() }, fechaRevocacion: null },
      data: { estado: 'EXPIRADA' },
    });
    return this.prisma.sancion.findMany({
      where: { voluntarioId, estado: 'ACTIVA' },
      include: { voluntario: true },
      orderBy: [{ fechaInicio: 'desc' }],
    });
  }
}

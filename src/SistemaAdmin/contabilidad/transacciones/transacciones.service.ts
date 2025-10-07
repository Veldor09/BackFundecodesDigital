import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class TransaccionesService {
  constructor(private prisma: PrismaService) {}

  private async ensureProject(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Proyecto no existe');
  }

  async create(dto: {
    tipo: 'ingreso' | 'egreso';
    categoria: string; descripcion: string; monto: number; fecha: string;
    projectId: number; proyecto: string;
  }) {
    if (dto.monto <= 0) throw new BadRequestException('El monto debe ser positivo');
    await this.ensureProject(dto.projectId);

    return this.prisma.transaccion.create({
      data: { ...dto, fecha: new Date(dto.fecha) },
    });
  }

  async findAll(filters: {
    projectId?: number; tipo?: 'ingreso' | 'egreso'; categoria?: string; fechaInicio?: string; fechaFin?: string;
  }) {
    return this.prisma.transaccion.findMany({
      where: {
        projectId: filters.projectId,
        tipo: filters.tipo,
        categoria: filters.categoria ? { contains: filters.categoria, mode: 'insensitive' } : undefined,
        fecha: {
          gte: filters.fechaInicio ? new Date(filters.fechaInicio) : undefined,
          lte: filters.fechaFin ? new Date(filters.fechaFin) : undefined,
        },
      },
      orderBy: { fecha: 'desc' },
    });
  }

  async update(id: string, dto: Partial<{
    tipo: 'ingreso' | 'egreso'; categoria: string; descripcion: string; monto: number; fecha: string; projectId: number; proyecto: string;
  }>) {
    const exists = await this.prisma.transaccion.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Transacción no encontrada');

    if (dto.monto != null && dto.monto <= 0) throw new BadRequestException('El monto debe ser positivo');
    if (dto.projectId != null) await this.ensureProject(dto.projectId);

    return this.prisma.transaccion.update({
      where: { id },
      data: { ...dto, fecha: dto.fecha ? new Date(dto.fecha) : undefined },
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.transaccion.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Transacción no encontrada');
    await this.prisma.transaccion.delete({ where: { id } });
    return { deleted: true };
  }
}

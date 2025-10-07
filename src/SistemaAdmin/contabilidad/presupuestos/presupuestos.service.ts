import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PresupuestosService {
  constructor(private prisma: PrismaService) {}

  private async ensureProject(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Proyecto no existe');
  }

  async create(data: {
    projectId: number; proyecto: string; mes: number; anio: number; montoAsignado: number; montoEjecutado: number;
  }) {
    if (data.montoAsignado < 0 || data.montoEjecutado < 0) {
      throw new BadRequestException('Los montos deben ser >= 0');
    }
    await this.ensureProject(data.projectId);

    return this.prisma.presupuesto.create({ data });
  }

  async findAll(filters: { projectId?: number; mes?: number; anio?: number }) {
    return this.prisma.presupuesto.findMany({
      where: {
        projectId: filters.projectId,
        mes: filters.mes,
        anio: filters.anio,
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }],
    });
  }

  async update(id: string, data: Partial<{ mes: number; anio: number; montoAsignado: number; montoEjecutado: number; proyecto: string }>) {
    const exists = await this.prisma.presupuesto.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Registro no encontrado');

    if (data.montoAsignado != null && data.montoAsignado < 0) throw new BadRequestException('montoAsignado >= 0');
    if (data.montoEjecutado != null && data.montoEjecutado < 0) throw new BadRequestException('montoEjecutado >= 0');

    return this.prisma.presupuesto.update({ where: { id }, data });
  }

  async remove(id: string) {
    const exists = await this.prisma.presupuesto.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Registro no encontrado');
    await this.prisma.presupuesto.delete({ where: { id } });
    return { deleted: true };
  }
}

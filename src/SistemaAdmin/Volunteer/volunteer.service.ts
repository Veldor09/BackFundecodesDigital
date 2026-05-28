import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

const SELECT_VOLUNTEER = {
  id: true,
  nombre: true,
  nacionalidad: true,
  fechaEntrada: true,
  fechaSalida: true,
  ong: true,
  email: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class VolunteerService {
  private readonly logger = new Logger(VolunteerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateVolunteerDto) {
    return this.prisma.voluntario.create({
      data: {
        nombre: data.nombre,
        nacionalidad: data.nacionalidad ?? null,
        fechaEntrada: new Date(data.fechaEntrada),
        fechaSalida: data.fechaSalida ? new Date(data.fechaSalida) : null,
        ong: data.ong ?? null,
        email: data.email ?? null,
      },
      select: SELECT_VOLUNTEER,
    });
  }

  async findAll(params: {
    q?: string;
    page?: number;
    pageSize?: number;
    soloActivos?: boolean;
  }) {
    const { q, page = 1, pageSize = 20, soloActivos = false } = params;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const where: any = {};

    if (q?.trim()) {
      where.OR = [
        { nombre: { contains: q, mode: 'insensitive' } },
        { ong: { contains: q, mode: 'insensitive' } },
        { nacionalidad: { contains: q, mode: 'insensitive' } },
      ];
    }

    // soloActivos: excluye voluntarios cuya fechaSalida ya pasó
    if (soloActivos) {
      where.OR = [
        { fechaSalida: null },
        { fechaSalida: { gte: today } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.voluntario.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { fechaEntrada: 'desc' },
        select: SELECT_VOLUNTEER,
      }),
      this.prisma.voluntario.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: number) {
    const found = await this.prisma.voluntario.findUnique({
      where: { id },
      select: SELECT_VOLUNTEER,
    });
    if (!found) throw new NotFoundException(`Voluntario ${id} no encontrado`);
    return found;
  }

  async update(id: number, data: UpdateVolunteerDto) {
    await this.findOne(id);
    return this.prisma.voluntario.update({
      where: { id },
      data: {
        ...(data.nombre !== undefined && { nombre: data.nombre }),
        ...(data.nacionalidad !== undefined && { nacionalidad: data.nacionalidad }),
        ...(data.fechaEntrada !== undefined && { fechaEntrada: new Date(data.fechaEntrada) }),
        ...(data.fechaSalida !== undefined && {
          fechaSalida: data.fechaSalida ? new Date(data.fechaSalida) : null,
        }),
        ...(data.ong !== undefined && { ong: data.ong }),
        ...(data.email !== undefined && { email: data.email }),
      },
      select: SELECT_VOLUNTEER,
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    return this.prisma.voluntario.delete({ where: { id } });
  }

  // ====================== CRON: Auto-eliminación ======================
  /**
   * Se ejecuta cada día a medianoche (00:00 hora del servidor).
   * Elimina todos los voluntarios cuya fechaSalida es anterior a hoy.
   * Ejemplo: si fechaSalida = 27/05/2026, se elimina a las 00:00 del 28/05/2026.
   */
  @Cron('0 0 * * *', { name: 'delete-expired-volunteers' })
  async deleteExpiredVolunteers() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const result = await this.prisma.voluntario.deleteMany({
      where: {
        fechaSalida: { not: null, lt: today },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `[CRON] Eliminados ${result.count} voluntario(s) con fechaSalida anterior a ${today.toISOString().split('T')[0]}`,
      );
    }
  }
}

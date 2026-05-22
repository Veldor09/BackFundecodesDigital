import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProgramaVoluntariadoDto } from './dto/create-programa-voluntariado.dto';
import { UpdateProgramaVoluntariadoDto } from './dto/update-programa-voluntariado.dto';
import { AsignarVoluntarioDto } from './dto/asignar-voluntario.dto';

// ✅ nuevo DTO parcial
import { UpdateAsignacionVoluntarioDto } from './dto/update-asignacion-voluntario.dto';

@Injectable()
export class ProgramaVoluntariadoService {
  constructor(private readonly prisma: PrismaService) {}

  // ===================== PROGRAMAS =====================

  async list(query: any) {
    const search = (query.search ?? '').trim();

    return this.prisma.programaVoluntariado.findMany({
      where: search
        ? {
            OR: [
              { nombre: { contains: search, mode: 'insensitive' } },
              { lugar: { contains: search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        voluntarios: {
          include: {
            voluntario: {
              select: { id: true, nombreCompleto: true, email: true, estado: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });
  }

  async findOne(id: number) {
    const prog = await this.prisma.programaVoluntariado.findUnique({
      where: { id },
      include: {
        voluntarios: {
          include: {
            voluntario: {
              select: { id: true, nombreCompleto: true, email: true, estado: true },
            },
          },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    if (!prog) throw new NotFoundException('Programa de voluntariado no encontrado');
    return prog;
  }

  async create(dto: CreateProgramaVoluntariadoDto) {
    return this.prisma.programaVoluntariado.create({ data: dto });
  }

  async update(id: number, dto: UpdateProgramaVoluntariadoDto) {
    await this.ensureExists(id);
    return this.prisma.programaVoluntariado.update({ where: { id }, data: dto });
  }

  async remove(id: number) {
    await this.ensureExists(id);
    await this.prisma.programaVoluntariado.delete({ where: { id } });
    return { message: 'Programa eliminado' };
  }

  private async ensureExists(id: number) {
    const exists = await this.prisma.programaVoluntariado.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Programa de voluntariado no encontrado');
  }

  // ===================== SALDO =====================

  async saldo(programaId: number) {
    const programa = await this.prisma.programaVoluntariado.findUnique({
      where: { id: programaId },
      select: { id: true, nombre: true, presupuestoTotal: true, monedaPresupuesto: true, cuentaId: true },
    });
    if (!programa) throw new NotFoundException('Programa no encontrado');

    const agg = await this.prisma.transaccion.groupBy({
      by: ['tipo'],
      where: { programaId, anuladaAt: null },
      _sum: { monto: true },
    });

    const toNum = (v: any) => (v ? Number(v.toString()) : 0);
    const presupuesto = toNum(programa.presupuestoTotal);
    const ingresos = toNum(agg.find((g: any) => g.tipo === 'ingreso')?._sum?.monto);
    const egresos = toNum(agg.find((g: any) => g.tipo === 'egreso')?._sum?.monto);
    const disponible = presupuesto + ingresos - egresos;
    const efectivo = presupuesto + ingresos;
    const porcentajeUtilizado = efectivo > 0
      ? Math.min(100, (egresos / efectivo) * 100)
      : 0;

    return {
      id: programa.id,
      nombre: programa.nombre,
      moneda: programa.monedaPresupuesto,
      presupuestoTotal: presupuesto,
      ingresos,
      egresos,
      ejecutado: egresos,
      disponible,
      porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
    };
  }

  // ===================== ASIGNACIONES =====================

  async assignVolunteer(programaId: number, voluntarioId: number, dto: AsignarVoluntarioDto) {
  const [programa, vol, totalAsignados] = await Promise.all([
    this.prisma.programaVoluntariado.findUnique({ where: { id: programaId } }),
    this.prisma.voluntario.findUnique({ where: { id: voluntarioId } }),
    this.prisma.programaVoluntariadoAsignacion.count({
      where: { programaId },
    }),
  ]);

  if (!programa) throw new NotFoundException('Programa no encontrado');
  if (!vol) throw new NotFoundException('Voluntario no encontrado');

  // ✅ validar cupo
  if (
    programa.limiteParticipantes > 0 &&
    totalAsignados >= programa.limiteParticipantes
  ) {
    throw new BadRequestException(
      `El programa ya alcanzó su límite de ${programa.limiteParticipantes} participantes`,
    );
  }

  if (dto.origen === 'INTERMEDIARIO' && !dto.intermediario?.trim()) {
    throw new BadRequestException('intermediario es requerido cuando origen=INTERMEDIARIO');
  }

  try {
    return await this.prisma.programaVoluntariadoAsignacion.create({
      data: {
        programaId,
        voluntarioId,
        pagoRealizado: dto.pagoRealizado,
        origen: dto.origen,
        intermediario: dto.intermediario?.trim() || null,
        fechaEntrada: new Date(dto.fechaEntrada),
        fechaSalida: dto.fechaSalida ? new Date(dto.fechaSalida) : null,
        horasTotales: dto.horasTotales,
      },
    });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      throw new BadRequestException('Voluntario ya está asignado a este programa');
    }
    throw e;
  }
}

  // ✅ AHORA: update parcial (sin upsert)
  async updateAssignment(
    programaId: number,
    voluntarioId: number,
    dto: UpdateAsignacionVoluntarioDto,
  ) {
    // regla: si mandan origen INTERMEDIARIO, intermediario requerido
    if (dto.origen === 'INTERMEDIARIO' && !dto.intermediario?.trim()) {
      throw new BadRequestException('intermediario es requerido cuando origen=INTERMEDIARIO');
    }

    // armamos data solo con lo que venga
    const data: any = {};
    if (dto.pagoRealizado !== undefined) data.pagoRealizado = dto.pagoRealizado;
    if (dto.origen !== undefined) data.origen = dto.origen;
    if (dto.intermediario !== undefined)
      data.intermediario = dto.intermediario?.trim() || null;

    if (dto.fechaEntrada !== undefined) data.fechaEntrada = new Date(dto.fechaEntrada);
    if (dto.fechaSalida !== undefined)
      data.fechaSalida = dto.fechaSalida ? new Date(dto.fechaSalida) : null;

    if (dto.horasTotales !== undefined) data.horasTotales = dto.horasTotales;

    try {
      return await this.prisma.programaVoluntariadoAsignacion.update({
        where: { programaId_voluntarioId: { programaId, voluntarioId } },
        data,
      });
    } catch (e: any) {
      if (e?.code === 'P2025') {
        throw new NotFoundException('El voluntario no está asignado a este programa');
      }
      throw e;
    }
  }

  async unassignVolunteer(programaId: number, voluntarioId: number) {
    try {
      await this.prisma.programaVoluntariadoAsignacion.delete({
        where: { programaId_voluntarioId: { programaId, voluntarioId } },
      });
    } catch (e: any) {
      if (e?.code !== 'P2025') throw e;
    }
    return { ok: true };
  }
}
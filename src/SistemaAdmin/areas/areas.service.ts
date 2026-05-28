import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Lista con filtros y paginación ────────────────────────────────────────
  async list(params: {
    q?: string;
    activa?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const { q, activa, page = 1, pageSize = 20 } = params;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AreaWhereInput = {
      ...(activa !== undefined && { activa }),
      ...(q && {
        OR: [
          { nombre: { contains: q, mode: 'insensitive' } },
          { descripcion: { contains: q, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.area.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { nombre: 'asc' },
        include: {
          _count: { select: { proyectos: true, programas: true, colaboradores: true } },
          cuenta: { select: { id: true, nombre: true, codigo: true } },
        },
      }),
      this.prisma.area.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  // ─── Obtener una área por ID ────────────────────────────────────────────────
  async findById(id: number) {
    const area = await this.prisma.area.findUnique({
      where: { id },
      include: {
        _count: { select: { proyectos: true, programas: true, colaboradores: true } },
        cuenta: { select: { id: true, nombre: true, codigo: true, monedaBase: true } },
        proyectos: {
          select: { id: true, title: true, status: true, presupuestoTotal: true },
          orderBy: { title: 'asc' },
        },
        programas: {
          select: { id: true, nombre: true, lugar: true, presupuestoTotal: true },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!area) throw new NotFoundException(`Área #${id} no encontrada`);
    return area;
  }

  // ─── Crear ─────────────────────────────────────────────────────────────────
  async create(dto: CreateAreaDto) {
    try {
      return await this.prisma.area.create({
        data: {
          nombre: dto.nombre,
          descripcion: dto.descripcion,
          activa: dto.activa ?? true,
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`Ya existe un área con el nombre "${dto.nombre}"`);
      }
      throw e;
    }
  }

  // ─── Actualizar ────────────────────────────────────────────────────────────
  async update(id: number, dto: UpdateAreaDto) {
    await this.ensureExists(id);
    try {
      return await this.prisma.area.update({
        where: { id },
        data: {
          ...(dto.nombre !== undefined && { nombre: dto.nombre }),
          ...(dto.descripcion !== undefined && { descripcion: dto.descripcion }),
          ...(dto.activa !== undefined && { activa: dto.activa }),
        },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new ConflictException(`Ya existe un área con el nombre "${dto.nombre}"`);
      }
      throw e;
    }
  }

  // ─── Archivar / Reactivar ──────────────────────────────────────────────────
  async archive(id: number) {
    await this.ensureExists(id);
    return this.prisma.area.update({ where: { id }, data: { activa: false } });
  }

  async restore(id: number) {
    await this.ensureExists(id);
    return this.prisma.area.update({ where: { id }, data: { activa: true } });
  }

  // ─── Eliminar ──────────────────────────────────────────────────────────────
  async remove(id: number) {
    await this.ensureExists(id);
    // Desvinculamos proyectos, programas y colaboradores antes de eliminar
    await this.prisma.$transaction([
      this.prisma.project.updateMany({ where: { areaId: id }, data: { areaId: null } }),
      this.prisma.programaVoluntariado.updateMany({ where: { areaId: id }, data: { areaId: null } }),
      this.prisma.collaborator.updateMany({ where: { areaId: id }, data: { areaId: null } }),
    ]);
    await this.prisma.area.delete({ where: { id } });
    return { message: `Área #${id} eliminada` };
  }

  // ─── Selector compacto (para formularios de otros módulos) ─────────────────
  async selector() {
    return this.prisma.area.findMany({
      where: { activa: true },
      select: { id: true, nombre: true, descripcion: true },
      orderBy: { nombre: 'asc' },
    });
  }

  // ─── Saldo del área (vía su cuenta asociada) ───────────────────────────────
  async getSaldo(areaId: number) {
    await this.ensureExists(areaId);

    const cuenta = await this.prisma.cuenta.findFirst({
      where: { areaId },
      select: { id: true },
    });

    if (!cuenta) {
      return { presupuestoTotal: 0, ingresos: 0, egresos: 0, disponible: 0, porcentajeUtilizado: 0 };
    }

    const cuentaId = cuenta.id;

    // Presupuesto total: suma de presupuestoTotal de proyectos + programas en esta cuenta
    const [proyPres, progPres] = await Promise.all([
      this.prisma.project.aggregate({ where: { cuentaId }, _sum: { presupuestoTotal: true } }),
      this.prisma.programaVoluntariado.aggregate({ where: { cuentaId }, _sum: { presupuestoTotal: true } }),
    ]);

    const presupuestoTotal =
      Number(proyPres._sum.presupuestoTotal ?? 0) +
      Number(progPres._sum.presupuestoTotal ?? 0);

    // Ingresos y egresos: transacciones cuyo cuentaId apunta a esta cuenta
    const agg = await this.prisma.transaccion.groupBy({
      by: ['tipo'],
      where: { cuentaId, anuladaAt: null },
      _sum: { monto: true },
    });

    const ingresos = Number(agg.find((g) => g.tipo === 'ingreso')?._sum.monto ?? 0);
    const egresos = Number(agg.find((g) => g.tipo === 'egreso')?._sum.monto ?? 0);
    const disponible = presupuestoTotal + ingresos - egresos;
    const porcentajeUtilizado = presupuestoTotal > 0
      ? Math.round((egresos / presupuestoTotal) * 100)
      : 0;

    return { presupuestoTotal, ingresos, egresos, disponible, porcentajeUtilizado };
  }

  // ─── Helper privado ────────────────────────────────────────────────────────
  private async ensureExists(id: number) {
    const exists = await this.prisma.area.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new NotFoundException(`Área #${id} no encontrada`);
  }
}

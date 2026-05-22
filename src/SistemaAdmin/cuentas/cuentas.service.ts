// src/SistemaAdmin/cuentas/cuentas.service.ts
//
// Service de Cuentas contables.
//
// Reglas:
//   • Una Cuenta NO almacena saldos propios. Todos los totales se calculan al
//     vuelo sumando los presupuestos asignados de sus proyectos/programas y
//     las transacciones cuyo `cuentaId` (snapshot) apunte a esta cuenta.
//   • Asignar/desasignar un proyecto o programa = setear/limpiar `cuentaId`
//     en la entidad correspondiente. Las transacciones VIEJAS conservan su
//     `cuentaId` original (su snapshot al momento de creación) por lo que el
//     histórico de la cuenta anterior permanece intacto.
//   • Soft-delete: la "baja" de una cuenta marca `activa = false`. No se
//     borra físicamente porque rompería el histórico de las transacciones
//     que la apuntan.
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { ListCuentasQuery } from './dto/list-cuentas.query';

type DecimalLike = Prisma.Decimal | number | string | null | undefined;

function toNumber(d: DecimalLike): number {
  if (d === null || d === undefined) return 0;
  if (typeof d === 'number') return d;
  if (typeof d === 'string') return Number(d) || 0;
  // Prisma.Decimal
  return Number(d.toString()) || 0;
}

@Injectable()
export class CuentasService {
  constructor(private readonly prisma: PrismaService) {}

  // ───────────────────────── CRUD básico ─────────────────────────

  async create(dto: CreateCuentaDto) {
    // codigo único — validamos antes para devolver mensaje claro (Prisma
    // P2002 también lo rechazaría, pero el mensaje es críptico).
    const existing = await this.prisma.cuenta.findUnique({
      where: { codigo: dto.codigo },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una cuenta con el código "${dto.codigo}".`,
      );
    }

    return this.prisma.cuenta.create({
      data: {
        nombre: dto.nombre,
        codigo: dto.codigo,
        descripcion: dto.descripcion ?? null,
        monedaBase: dto.monedaBase ?? 'CRC',
        activa: dto.activa ?? true,
      },
    });
  }

  async findAll(query: ListCuentasQuery) {
    const page = Math.max(1, Number(query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(query.pageSize ?? 20)));
    const skip = (page - 1) * pageSize;

    const where: Prisma.CuentaWhereInput = {};
    if (typeof query.activa === 'boolean') where.activa = query.activa;
    if (query.q && query.q.trim()) {
      const term = query.q.trim();
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { codigo: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.cuenta.findMany({
        where,
        orderBy: [{ activa: 'desc' }, { codigo: 'asc' }],
        skip,
        take: pageSize,
        // Conteos básicos para que la tabla de listado pueda mostrar "X proyectos / Y programas"
        // sin tener que pedir el resumen completo por cada fila.
        include: {
          _count: {
            select: {
              proyectos: true,
              programas: true,
            },
          },
        },
      }),
      this.prisma.cuenta.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async findOne(id: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      include: {
        proyectos: {
          select: {
            id: true,
            title: true,
            status: true,
            presupuestoTotal: true,
            monedaPresupuesto: true,
          },
          orderBy: { title: 'asc' },
        },
        programas: {
          select: {
            id: true,
            nombre: true,
            presupuestoTotal: true,
            monedaPresupuesto: true,
          },
          orderBy: { nombre: 'asc' },
        },
      },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    return cuenta;
  }

  async update(id: number, dto: UpdateCuentaDto) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      select: { id: true, codigo: true },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    if (dto.codigo && dto.codigo !== cuenta.codigo) {
      const dup = await this.prisma.cuenta.findUnique({
        where: { codigo: dto.codigo },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          `Ya existe una cuenta con el código "${dto.codigo}".`,
        );
      }
    }

    return this.prisma.cuenta.update({
      where: { id },
      data: {
        nombre: dto.nombre ?? undefined,
        codigo: dto.codigo ?? undefined,
        descripcion: dto.descripcion ?? undefined,
        monedaBase: dto.monedaBase ?? undefined,
        activa: dto.activa ?? undefined,
      },
    });
  }

  /**
   * Soft-delete: archiva la cuenta. No se borra físicamente porque
   * transacciones históricas la apuntan vía `cuentaId` y debemos preservar
   * la trazabilidad contable.
   */
  async archive(id: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      select: { id: true, activa: true },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    if (!cuenta.activa) {
      throw new BadRequestException('La cuenta ya está archivada');
    }
    return this.prisma.cuenta.update({
      where: { id },
      data: { activa: false },
    });
  }

  async restore(id: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id },
      select: { id: true, activa: true },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');
    if (cuenta.activa) {
      throw new BadRequestException('La cuenta ya está activa');
    }
    return this.prisma.cuenta.update({
      where: { id },
      data: { activa: true },
    });
  }

  // ─────────────── Asignación de proyectos / programas ───────────────

  /**
   * Asigna un proyecto a esta cuenta. Si el proyecto ya estaba en otra
   * cuenta, se "muda": el `cuentaId` se actualiza, pero las transacciones
   * VIEJAS conservan su `cuentaId` original (snapshot). El proyecto empieza
   * desde cero en la cuenta destino para efectos de cálculo de saldo.
   */
  async asignarProyecto(cuentaId: number, projectId: number) {
    await this.assertCuentaExists(cuentaId);
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, cuentaId: true, title: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    if (project.cuentaId === cuentaId) {
      return { ok: true, mensaje: 'El proyecto ya pertenece a esta cuenta' };
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { cuentaId },
    });

    return {
      ok: true,
      mensaje: project.cuentaId
        ? `Proyecto "${project.title}" trasladado a la cuenta nueva. Las transacciones anteriores se mantienen en la cuenta original.`
        : `Proyecto "${project.title}" asignado.`,
    };
  }

  async desasignarProyecto(cuentaId: number, projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, cuentaId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (project.cuentaId !== cuentaId) {
      throw new BadRequestException(
        'El proyecto no pertenece a esta cuenta actualmente',
      );
    }

    await this.prisma.project.update({
      where: { id: projectId },
      data: { cuentaId: null },
    });
    return { ok: true };
  }

  async asignarPrograma(cuentaId: number, programaId: number) {
    await this.assertCuentaExists(cuentaId);
    const programa = await this.prisma.programaVoluntariado.findUnique({
      where: { id: programaId },
      select: { id: true, cuentaId: true, nombre: true },
    });
    if (!programa) throw new NotFoundException('Programa no encontrado');

    if (programa.cuentaId === cuentaId) {
      return { ok: true, mensaje: 'El programa ya pertenece a esta cuenta' };
    }

    await this.prisma.programaVoluntariado.update({
      where: { id: programaId },
      data: { cuentaId },
    });

    return {
      ok: true,
      mensaje: programa.cuentaId
        ? `Programa "${programa.nombre}" trasladado a la cuenta nueva. Las transacciones anteriores se mantienen en la cuenta original.`
        : `Programa "${programa.nombre}" asignado.`,
    };
  }

  async desasignarPrograma(cuentaId: number, programaId: number) {
    const programa = await this.prisma.programaVoluntariado.findUnique({
      where: { id: programaId },
      select: { id: true, cuentaId: true },
    });
    if (!programa) throw new NotFoundException('Programa no encontrado');
    if (programa.cuentaId !== cuentaId) {
      throw new BadRequestException(
        'El programa no pertenece a esta cuenta actualmente',
      );
    }

    await this.prisma.programaVoluntariado.update({
      where: { id: programaId },
      data: { cuentaId: null },
    });
    return { ok: true };
  }

  // ─────────────────── Resumen financiero ────────────────────

  /**
   * Calcula los totales agregados de la cuenta:
   *   - presupuestoAsignado = suma de presupuestoTotal de proyectos y programas
   *     ACTUALMENTE en la cuenta.
   *   - ingresos = suma de transacciones tipo INGRESO con cuentaId=esta cuenta
   *     (no anuladas).
   *   - egresos = suma de transacciones tipo EGRESO con cuentaId=esta cuenta
   *     (no anuladas).
   *   - ejecutado = egresos (lo que efectivamente se ha gastado).
   *   - disponible = (presupuestoAsignado + ingresos) - egresos.
   *   - porcentajeUtilizado = ejecutado / (presupuestoAsignado + ingresos).
   *
   * Nota sobre monedas: agregamos en una moneda implícita (la base de la
   * cuenta). Las transacciones de otra moneda igual se suman como número
   * para no perder datos, pero el front debería avisar si hay mezcla. Una
   * conversión real con tipo de cambio queda fuera de scope por ahora.
   */
  async resumen(cuentaId: number) {
    const cuenta = await this.prisma.cuenta.findUnique({
      where: { id: cuentaId },
      select: {
        id: true,
        nombre: true,
        codigo: true,
        monedaBase: true,
        activa: true,
      },
    });
    if (!cuenta) throw new NotFoundException('Cuenta no encontrada');

    const [proyectos, programas, agg] = await Promise.all([
      this.prisma.project.findMany({
        where: { cuentaId },
        select: { id: true, presupuestoTotal: true, monedaPresupuesto: true },
      }),
      this.prisma.programaVoluntariado.findMany({
        where: { cuentaId },
        select: { id: true, presupuestoTotal: true, monedaPresupuesto: true },
      }),
      this.prisma.transaccion.groupBy({
        by: ['tipo'],
        where: {
          cuentaId,
          anuladaAt: null,
        },
        _sum: { monto: true },
      }),
    ]);

    const presupuestoAsignado =
      proyectos.reduce((a, p) => a + toNumber(p.presupuestoTotal), 0) +
      programas.reduce((a, p) => a + toNumber(p.presupuestoTotal), 0);

    const ingresos = toNumber(
      agg.find((g) => g.tipo === 'ingreso')?._sum.monto ?? null,
    );
    const egresos = toNumber(
      agg.find((g) => g.tipo === 'egreso')?._sum.monto ?? null,
    );

    const presupuestoEfectivo = presupuestoAsignado + ingresos;
    const ejecutado = egresos;
    const disponible = presupuestoEfectivo - ejecutado;
    const porcentajeUtilizado =
      presupuestoEfectivo > 0
        ? Math.min(100, (ejecutado / presupuestoEfectivo) * 100)
        : 0;

    return {
      cuenta,
      totales: {
        presupuestoAsignado,
        ingresos,
        egresos,
        ejecutado,
        presupuestoEfectivo,
        disponible,
        porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
      },
      contadores: {
        proyectos: proyectos.length,
        programas: programas.length,
      },
    };
  }

  // ─────────────────── helpers ───────────────────
  private async assertCuentaExists(id: number) {
    const exists = await this.prisma.cuenta.findUnique({
      where: { id },
      select: { id: true, activa: true },
    });
    if (!exists) throw new NotFoundException('Cuenta no encontrada');
    if (!exists.activa) {
      throw new BadRequestException(
        'La cuenta está archivada. Reactívala antes de asignar o trasladar.',
      );
    }
  }
}

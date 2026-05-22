import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Currency } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { CreateTransaccionDto } from './dto/create-transaccion.dto';

@Injectable()
export class TransaccionesService {
  constructor(private prisma: PrismaService) {}

  private normalizeMoneda(m?: string): Currency {
    const val = (m ?? 'CRC').toUpperCase();
    if (!['CRC', 'USD', 'EUR'].includes(val))
      throw new BadRequestException('Moneda inválida');
    return val as Currency;
  }

  // ─────────────────────── CREATE ───────────────────────
  async create(dto: CreateTransaccionDto) {
    if (dto.monto <= 0) throw new BadRequestException('El monto debe ser positivo');

    // XOR: exactamente uno de projectId/programaId
    const hasProject = !!dto.projectId;
    const hasPrograma = !!dto.programaId;
    if (hasProject === hasPrograma) {
      throw new BadRequestException(
        'Debe indicar exactamente uno de projectId o programaId, no ambos ni ninguno.',
      );
    }

    // Resolver cuentaId (snapshot) desde el destino actual
    let cuentaId: number | null = null;
    if (hasProject) {
      const project = await this.prisma.project.findUnique({
        where: { id: dto.projectId },
        select: { id: true, cuentaId: true },
      });
      if (!project) throw new BadRequestException('Proyecto no existe');
      cuentaId = project.cuentaId ?? null;
    } else {
      const programa = await this.prisma.programaVoluntariado.findUnique({
        where: { id: dto.programaId },
        select: { id: true, cuentaId: true },
      });
      if (!programa) throw new BadRequestException('Programa no existe');
      cuentaId = programa.cuentaId ?? null;
    }

    return this.prisma.transaccion.create({
      data: {
        fecha: new Date(dto.fecha),
        tipo: dto.tipo as any,
        categoria: dto.categoria.trim(),
        descripcion: dto.descripcion.trim(),
        monto: new Prisma.Decimal(dto.monto),
        moneda: this.normalizeMoneda(dto.moneda),
        projectId: dto.projectId ?? null,
        programaId: dto.programaId ?? null,
        cuentaId,
        proyecto: dto.proyecto.trim(),
      },
    });
  }

  // ─────────────────────── LIST ────────────────────────
  async findAll(filters: {
    projectId?: number;
    programaId?: number;
    cuentaId?: number;
    tipo?: 'ingreso' | 'egreso';
    categoria?: string;
    fechaInicio?: string;
    fechaFin?: string;
    moneda?: 'CRC' | 'USD' | 'EUR';
    incluirAnuladas?: boolean;
  }) {
    const where: Prisma.TransaccionWhereInput = {};

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.programaId) where.programaId = filters.programaId;
    if (filters.cuentaId) where.cuentaId = filters.cuentaId;
    if (filters.tipo) where.tipo = filters.tipo as any;
    if (filters.moneda) where.moneda = filters.moneda as any;
    if (filters.categoria) {
      where.categoria = { contains: filters.categoria, mode: 'insensitive' };
    }
    if (filters.fechaInicio || filters.fechaFin) {
      where.fecha = {
        gte: filters.fechaInicio ? new Date(filters.fechaInicio) : undefined,
        lte: filters.fechaFin ? new Date(filters.fechaFin) : undefined,
      };
    }
    // Por defecto excluimos anuladas para no confundir al contador
    if (!filters.incluirAnuladas) {
      where.anuladaAt = null;
    }

    return this.prisma.transaccion.findMany({
      where,
      orderBy: { fecha: 'desc' },
      include: {
        project: { select: { id: true, title: true } },
        programa: { select: { id: true, nombre: true } },
        anulaTransaccion: { select: { id: true, tipo: true, monto: true } },
        anuladaPorTx: { select: { id: true } },
      },
    });
  }

  // ─────────────────────── ANULAR ───────────────────────
  // Las transacciones nunca se eliminan. Para revertir se crea una
  // contra-transacción del tipo opuesto y se marca la original como anulada.
  async anular(id: string, motivo: string, anuladaPorUsuarioId?: number) {
    const original = await this.prisma.transaccion.findUnique({
      where: { id },
    });
    if (!original) throw new NotFoundException('Transacción no encontrada');
    if (original.anuladaAt) {
      throw new BadRequestException('La transacción ya está anulada');
    }
    if (original.paymentId) {
      throw new BadRequestException(
        'Esta transacción fue generada automáticamente por un pago. Para revertirla, anula el pago correspondiente.',
      );
    }

    // Tipo opuesto para la contra-transacción
    const tipoOpuesto = original.tipo === 'ingreso' ? 'egreso' : 'ingreso';

    await this.prisma.$transaction([
      // 1) Contra-transacción con tipo opuesto
      this.prisma.transaccion.create({
        data: {
          fecha: new Date(),
          tipo: tipoOpuesto as any,
          categoria: 'Anulación',
          descripcion: `Anulación de transacción ${id}: ${motivo}`,
          monto: original.monto,
          moneda: original.moneda,
          projectId: original.projectId,
          programaId: original.programaId,
          cuentaId: original.cuentaId,
          proyecto: original.proyecto,
          anulaTransaccionId: id,
        },
      }),
      // 2) Marcar la original
      this.prisma.transaccion.update({
        where: { id },
        data: {
          anuladaAt: new Date(),
          anuladaPor: anuladaPorUsuarioId ?? null,
        },
      }),
    ]);

    return { ok: true, mensaje: 'Transacción anulada correctamente' };
  }

  // ──────────────── SALDO de un proyecto ────────────────
  async saldoProyecto(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, presupuestoTotal: true, monedaPresupuesto: true, cuentaId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    return this._calcularSaldo({
      nombre: project.title,
      presupuestoTotal: project.presupuestoTotal,
      moneda: project.monedaPresupuesto,
      where: { projectId, anuladaAt: null },
    });
  }

  // ──────────────── SALDO de un programa ────────────────
  async saldoPrograma(programaId: number) {
    const programa = await this.prisma.programaVoluntariado.findUnique({
      where: { id: programaId },
      select: { id: true, nombre: true, presupuestoTotal: true, monedaPresupuesto: true, cuentaId: true },
    });
    if (!programa) throw new NotFoundException('Programa no encontrado');

    return this._calcularSaldo({
      nombre: programa.nombre,
      presupuestoTotal: programa.presupuestoTotal,
      moneda: programa.monedaPresupuesto,
      where: { programaId, anuladaAt: null },
    });
  }

  private async _calcularSaldo(params: {
    nombre: string;
    presupuestoTotal: Prisma.Decimal;
    moneda: string;
    where: Prisma.TransaccionWhereInput;
  }) {
    const agg = await this.prisma.transaccion.groupBy({
      by: ['tipo'],
      where: params.where,
      _sum: { monto: true },
    });

    const toNum = (v: Prisma.Decimal | null | undefined) =>
      v ? Number(v.toString()) : 0;

    const presupuesto = toNum(params.presupuestoTotal);
    const ingresos = toNum(agg.find((g) => g.tipo === 'ingreso')?._sum.monto);
    const egresos = toNum(agg.find((g) => g.tipo === 'egreso')?._sum.monto);
    const ejecutado = egresos;
    const disponible = presupuesto + ingresos - egresos;
    const efectivo = presupuesto + ingresos;
    const porcentajeUtilizado =
      efectivo > 0 ? Math.min(100, (ejecutado / efectivo) * 100) : 0;

    return {
      nombre: params.nombre,
      moneda: params.moneda,
      presupuestoTotal: presupuesto,
      ingresos,
      egresos,
      ejecutado,
      disponible,
      porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
    };
  }
}

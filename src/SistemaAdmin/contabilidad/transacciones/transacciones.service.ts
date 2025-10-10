import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma, Currency } from '@prisma/client'
import { PrismaService } from '../../../prisma/prisma.service'

@Injectable()
export class TransaccionesService {
  constructor(private prisma: PrismaService) {}

  private async ensureProject(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } })
    if (!project) throw new BadRequestException('Proyecto no existe')
  }

  private normalizeMoneda(m?: string): Currency {
    const val = (m ?? 'CRC').toUpperCase()
    if (!['CRC','USD','EUR'].includes(val)) throw new BadRequestException('Moneda inválida')
    return val as Currency
  }

  async create(dto: {
    tipo: 'ingreso' | 'egreso';
    categoria: string; descripcion: string; monto: number; fecha: string;
    projectId: number; proyecto: string; moneda: 'CRC'|'USD'|'EUR';
  }) {
    if (dto.monto <= 0) throw new BadRequestException('El monto debe ser positivo')
    await this.ensureProject(dto.projectId)

    return this.prisma.transaccion.create({
      data: {
        fecha: new Date(dto.fecha),
        tipo: dto.tipo as any, // si usas enum Prisma, mapea a mayúsculas aquí
        categoria: dto.categoria.trim(),
        descripcion: dto.descripcion.trim(),
        monto: new Prisma.Decimal(dto.monto),
        moneda: this.normalizeMoneda(dto.moneda),
        projectId: dto.projectId,
        proyecto: dto.proyecto,
      },
    })
  }

  async findAll(filters: {
    projectId?: number; tipo?: 'ingreso' | 'egreso'; categoria?: string; fechaInicio?: string; fechaFin?: string; moneda?: 'CRC'|'USD'|'EUR';
  }) {
    return this.prisma.transaccion.findMany({
      where: {
        projectId: filters.projectId,
        tipo: filters.tipo as any,
        categoria: filters.categoria ? { contains: filters.categoria, mode: 'insensitive' } : undefined,
        moneda: filters.moneda ? (filters.moneda as any) : undefined,
        fecha: {
          gte: filters.fechaInicio ? new Date(filters.fechaInicio) : undefined,
          lte: filters.fechaFin ? new Date(filters.fechaFin) : undefined,
        },
      },
      orderBy: { fecha: 'desc' },
    })
  }

  async update(id: string, dto: Partial<{
    tipo: 'ingreso' | 'egreso'; categoria: string; descripcion: string; monto: number; fecha: string; projectId: number; proyecto: string; moneda: 'CRC'|'USD'|'EUR';
  }>) {
    const exists = await this.prisma.transaccion.findUnique({ where: { id } })
    if (!exists) throw new NotFoundException('Transacción no encontrada')

    if (dto.monto != null && dto.monto <= 0) throw new BadRequestException('El monto debe ser positivo')
    if (dto.projectId != null) await this.ensureProject(dto.projectId)

    return this.prisma.transaccion.update({
      where: { id },
      data: {
        tipo: dto.tipo as any,
        categoria: dto.categoria?.trim(),
        descripcion: dto.descripcion?.trim(),
        monto: dto.monto != null ? new Prisma.Decimal(dto.monto) : undefined,
        fecha: dto.fecha ? new Date(dto.fecha) : undefined,
        moneda: dto.moneda ? this.normalizeMoneda(dto.moneda) : undefined,
        projectId: dto.projectId ?? undefined,
        proyecto: dto.proyecto ?? undefined,
      },
    })
  }

  async remove(id: string) {
    const exists = await this.prisma.transaccion.findUnique({ where: { id } })
    if (!exists) throw new NotFoundException('Transacción no encontrada')
    await this.prisma.transaccion.delete({ where: { id } })
    return { deleted: true }
  }
}

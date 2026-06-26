import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVisitacionDto } from './dto/create-visitacion.dto';
import { UpdateVisitacionDto } from './dto/update-visitacion.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class VisitacionesService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── helpers ────────────────────────────────────────────────────────────────

  private extranjeros(total: number, nacionales: number): number {
    const ext = total - nacionales;
    if (ext < 0) throw new BadRequestException('Los nacionales no pueden superar el total de personas.');
    return ext;
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────────

  async create(dto: CreateVisitacionDto) {
    const ext = this.extranjeros(dto.totalPersonas, dto.nacionales);
    return this.prisma.visitacion.create({
      data: {
        fecha: new Date(dto.fecha),
        totalPersonas: dto.totalPersonas,
        nacionales: dto.nacionales,
        extranjeros: ext,
        paisesExtranjeros: dto.paisesExtranjeros ?? Prisma.DbNull,
        notas: dto.notas ?? null,
      },
    });
  }

  async findAll(params: {
    page?: number;
    limit?: number;
    q?: string;
  }) {
    const page  = Math.max(1, params.page  ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 10));
    const skip  = (page - 1) * limit;

    const where: Prisma.VisitacionWhereInput = {};

    if (params.q) {
      where.notas = { contains: params.q, mode: 'insensitive' };
    }

    const [total, data] = await this.prisma.$transaction([
      this.prisma.visitacion.count({ where }),
      this.prisma.visitacion.findMany({
        where,
        orderBy: { fecha: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return { total, page, limit, data };
  }

  async findOne(id: number) {
    const v = await this.prisma.visitacion.findUnique({ where: { id } });
    if (!v) throw new NotFoundException(`Visitación #${id} no encontrada`);
    return v;
  }

  async update(id: number, dto: UpdateVisitacionDto) {
    await this.findOne(id);

    // Recalcular extranjeros si llegan total o nacionales
    const current = await this.findOne(id);
    const total     = dto.totalPersonas ?? current.totalPersonas;
    const nacionales = dto.nacionales ?? current.nacionales;
    const ext = this.extranjeros(total, nacionales);

    return this.prisma.visitacion.update({
      where: { id },
      data: {
        ...(dto.fecha        != null ? { fecha: new Date(dto.fecha) }   : {}),
        ...(dto.totalPersonas != null ? { totalPersonas: dto.totalPersonas } : {}),
        ...(dto.nacionales    != null ? { nacionales: dto.nacionales }       : {}),
        extranjeros: ext,
        ...(dto.paisesExtranjeros !== undefined ? { paisesExtranjeros: dto.paisesExtranjeros ?? Prisma.DbNull } : {}),
        ...(dto.notas         !== undefined ? { notas: dto.notas ?? null }   : {}),
      },
    });
  }

  async remove(id: number) {
    await this.findOne(id);
    await this.prisma.visitacion.delete({ where: { id } });
    return { ok: true };
  }
}

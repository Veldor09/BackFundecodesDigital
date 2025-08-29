import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ListProjectsQuery } from './dto/list-projects.query';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  // Lista con filtros, paginación y orden por defecto (más recientes)
  async list(query: ListProjectsQuery) {
    const { q, category, status, place, area, page = 1, pageSize = 10, published } = query;

    // Compatibilidad: usamos 'as any' para no depender del cliente generado aún
    const where = {} as any;

    if (q) {
      where.OR = [
        { title:   { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }

    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (status)   where.status   = status; // luego lo tipamos con el enum generado
    if (place)    where.place    = { contains: place, mode: 'insensitive' };
    if (area)     where.area     = { contains: area,  mode: 'insensitive' };
    if (published !== undefined) where.published = published;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({ where, orderBy: { updatedAt: 'desc' }, skip, take }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  // Detalle por slug
  async getBySlug(slug: string) {
    const found = await this.prisma.project.findUnique({ where: { slug } });
    if (!found) throw new NotFoundException('Proyecto no encontrado');
    return found;
  }

  // Crear
  create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto as any });
  }

  // Actualizar
  async update(id: string, dto: UpdateProjectDto) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    return this.prisma.project.update({ where: { id }, data: dto as any });
  }

  // Eliminar
  async remove(id: string) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
}

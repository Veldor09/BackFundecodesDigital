import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { ListProjectsQuery } from './dto/list-projects.query';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProjectsQuery) {
    const { q, category, status, place, area, page = 1, pageSize = 10, published } = query;

    // Si tu cliente Prisma ya refleja los campos, puedes usar ProjectWhereInput en vez de any.
    const where: Prisma.ProjectWhereInput = {};

    if (q) {
      where.OR = [
        { title:   { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (status)   (where as any).status = status; // cambia a Prisma.$Enums.ProjectStatus si tu cliente lo expone
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

  async getBySlug(slug: string) {
    const found = await this.prisma.project.findUnique({ where: { slug } });
    if (!found) throw new NotFoundException('Proyecto no encontrado');
    return found;
  }

  create(dto: CreateProjectDto) {
    return this.prisma.project.create({ data: dto as any });
  }

  // id: number en where (estricto y correcto)
  async update(id: number, dto: UpdateProjectDto) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    return this.prisma.project.update({ where: { id }, data: dto as any });
  }

  async remove(id: number) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
}

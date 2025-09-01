import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListProjectsQuery } from './dto/list-projects.query';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListProjectsQuery) {
    const { q, category, status, place, area, page = 1, pageSize = 10, published } = query;

    const where: Record<string, any> = {};

    if (q) {
      where.OR = [
        { title: { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (category) where.category = { contains: category, mode: 'insensitive' };
    if (status) where.status = status;
    if (place) where.place = { contains: place, mode: 'insensitive' };
    if (area) where.area = { contains: area, mode: 'insensitive' };
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

  async create(dto: CreateProjectDto) {
    const title = dto.title?.trim();
    if (!title) throw new BadRequestException('El campo "title" es requerido y no puede estar vacío.');

    const category = dto.category?.trim();
    const place = dto.place?.trim();
    const area = dto.area?.trim();

    if (!category) throw new BadRequestException('El campo "category" es requerido.');
    if (!place) throw new BadRequestException('El campo "place" es requerido.');
    if (!area) throw new BadRequestException('El campo "area" es requerido.');

    // Verificar duplicado por combinación title + place + area
    const dupCombo = await this.prisma.project.findFirst({
      where: { title, place, area },
    });
    if (dupCombo) {
      throw new BadRequestException(
        `Ya existe un proyecto con el título "${title}" en el lugar "${place}" y área "${area}".`,
      );
    }

    // slug = title + place
    const baseForSlug = dto.slug?.trim() || `${title}-${place}`;
    const slug = slugify(baseForSlug);
    if (!slug) throw new BadRequestException('No fue posible generar un slug válido.');

    // validar unicidad de slug
    const dupSlug = await this.prisma.project.findUnique({ where: { slug } });
    if (dupSlug) throw new BadRequestException(`El slug "${slug}" ya existe.`);

    return this.prisma.project.create({
      data: {
        ...dto,
        title,
        slug,
        category,
        place,
        area,
      } as any,
    });
  }

  async update(id: number, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proyecto no encontrado');

    // mantener valores actuales
    let nextTitle = existing.title;
    let nextCategory = existing.category;
    let nextPlace = existing.place;
    let nextArea = existing.area;

    if (dto.title !== undefined) {
      const t = dto.title.trim();
      if (!t) throw new BadRequestException('El campo "title" no puede estar vacío.');
      nextTitle = t;
    }
    if (dto.category !== undefined) {
      const c = dto.category.trim();
      if (!c) throw new BadRequestException('El campo "category" no puede estar vacío.');
      nextCategory = c;
    }
    if (dto.place !== undefined) {
      const p = dto.place.trim();
      if (!p) throw new BadRequestException('El campo "place" no puede estar vacío.');
      nextPlace = p;
    }
    if (dto.area !== undefined) {
      const a = dto.area.trim();
      if (!a) throw new BadRequestException('El campo "area" no puede estar vacío.');
      nextArea = a;
    }

    // Verificar duplicado por combinación title + place + area (excluyendo este id)
    const dupCombo = await this.prisma.project.findFirst({
      where: {
        title: nextTitle,
        place: nextPlace,
        area: nextArea,
        NOT: { id },
      },
    });
    if (dupCombo) {
      throw new BadRequestException(
        `Ya existe un proyecto con el título "${nextTitle}" en el lugar "${nextPlace}" y área "${nextArea}".`,
      );
    }

    // slug
    let nextSlug = existing.slug;
    if (dto.slug && dto.slug.trim().length) {
      nextSlug = slugify(dto.slug);
    } else if (dto.title !== undefined || dto.place !== undefined) {
      nextSlug = slugify(`${nextTitle}-${nextPlace}`);
    }
    if (!nextSlug) throw new BadRequestException('No fue posible generar un slug válido.');

    if (nextSlug !== existing.slug) {
      const dupSlug = await this.prisma.project.findUnique({ where: { slug: nextSlug } });
      if (dupSlug && dupSlug.id !== id) {
        throw new BadRequestException(`El slug "${nextSlug}" ya existe.`);
      }
    }

    return this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        title: nextTitle,
        slug: nextSlug,
        category: nextCategory,
        place: nextPlace,
        area: nextArea,
      } as any,
    });
  }

  async remove(id: number) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
}

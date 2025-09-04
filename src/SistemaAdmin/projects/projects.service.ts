// src/SistemaAdmin/projects/projects.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ListProjectsQuery } from './dto/list-projects.query';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

// Util mínimo por si el middleware no alcanzara a normalizar
function slugify(input: string): string {
  return (input ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista con filtros y paginación (incluye imágenes ordenadas)
   */
  async list(query: ListProjectsQuery) {
    let { q, category, status, place, area, page = 1, pageSize = 10, published } = query;

    // Sanitizar paginación
    page = isFiniteNumber(+page) && +page > 0 ? +page : 1;
    pageSize = isFiniteNumber(+pageSize) && +pageSize > 0 ? Math.min(+pageSize, 100) : 10;

    const where: Record<string, any> = {};

    if (q?.trim()) {
      where.OR = [
        { title:   { contains: q, mode: 'insensitive' } },
        { summary: { contains: q, mode: 'insensitive' } },
        { content: { contains: q, mode: 'insensitive' } },
        { place:   { contains: q, mode: 'insensitive' } },
        { area:    { contains: q, mode: 'insensitive' } },
        { category:{ contains: q, mode: 'insensitive' } },
      ];
    }
    if (category?.trim()) where.category = { contains: category.trim(), mode: 'insensitive' };
    if (status) where.status = status; // validado por DTO si usas class-validator con enum
    if (place?.trim()) where.place = { contains: place.trim(), mode: 'insensitive' };
    if (area?.trim()) where.area = { contains: area.trim(), mode: 'insensitive' };
    if (published !== undefined) where.published = published;

    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const [items, total] = await Promise.all([
      this.prisma.project.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take,
        include: {
          images: { orderBy: { order: 'asc' as const } },
        },
      }),
      this.prisma.project.count({ where }),
    ]);

    return { items, total, page, pageSize };
  }

  /**
   * Devuelve un proyecto por slug con imágenes
   */
  async getBySlug(slug: string) {
    const found = await this.prisma.project.findUnique({
      where: { slug },
      include: {
        images: { orderBy: { order: 'asc' as const } },
      },
    });
    if (!found) throw new NotFoundException('Proyecto no encontrado');
    return found;
  }

  /**
   * Devuelve proyecto por id numérico o slug (auto-detección) con imágenes
   */
  async findOne(idOrSlug: string) {
    const asNumber = Number(idOrSlug);
    const where = Number.isInteger(asNumber) && asNumber > 0
      ? { id: asNumber }
      : { slug: idOrSlug };

    const project = await this.prisma.project.findFirst({
      where,
      include: {
        images: { orderBy: { order: 'asc' as const } },
      },
    });

    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  /**
   * Crea proyecto respetando unicidad (title+place+area) y slug único.
   * Si published=true y no hay publishedAt, lo asigna ahora.
   */
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
      select: { id: true },
    });
    if (dupCombo) {
      throw new BadRequestException(
        `Ya existe un proyecto con el título "${title}" en el lugar "${place}" y área "${area}".`,
      );
    }

    // slug = (dto.slug) || (title + place)
    const baseForSlug = dto.slug?.trim() || `${title}-${place}`;
    const slug = slugify(baseForSlug);
    if (!slug) throw new BadRequestException('No fue posible generar un slug válido.');

    // validar unicidad de slug
    const dupSlug = await this.prisma.project.findUnique({ where: { slug }, select: { id: true } });
    if (dupSlug) throw new BadRequestException(`El slug "${slug}" ya existe.`);

    // Manejo de publishedAt (DTO trae string ISO opcional -> convertir a Date)
    const published = dto.published ?? false;
    const publishedAt = published
      ? (dto.publishedAt ? new Date(dto.publishedAt) : new Date())
      : null;

    const created = await this.prisma.project.create({
      data: {
        ...dto,
        title,
        slug,
        category,
        place,
        area,
        published,
        publishedAt,
      } as any,
    });

    return created;
  }

  /**
   * Actualiza proyecto con validaciones y manejo de slug/publishedAt
   */
  async update(id: number, dto: UpdateProjectDto) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Proyecto no encontrado');

    // Mantener valores actuales
    let nextTitle    = existing.title;
    let nextCategory = existing.category;
    let nextPlace    = existing.place;
    let nextArea     = existing.area;

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
      where: { title: nextTitle, place: nextPlace, area: nextArea, NOT: { id } },
      select: { id: true },
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
      const dupSlug = await this.prisma.project.findUnique({ where: { slug: nextSlug }, select: { id: true } });
      if (dupSlug && dupSlug.id !== id) {
        throw new BadRequestException(`El slug "${nextSlug}" ya existe.`);
      }
    }

    // Manejo published/publishedAt (DTO trae string ISO opcional -> convertir a Date)
    let nextPublished   = existing.published;
    let nextPublishedAt = existing.publishedAt;

    if (dto.published !== undefined) {
      nextPublished = dto.published;
      if (dto.published === true && !existing.publishedAt) {
        nextPublishedAt = dto.publishedAt ? new Date(dto.publishedAt) : new Date();
      }
      if (dto.published === false) {
        nextPublishedAt = null;
      }
    }
    if (dto.publishedAt !== undefined) {
      nextPublishedAt = dto.publishedAt ? new Date(dto.publishedAt) : null;
    }

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        ...dto,
        title:    nextTitle,
        slug:     nextSlug,
        category: nextCategory,
        place:    nextPlace,
        area:     nextArea,
        published:   nextPublished,
        publishedAt: nextPublishedAt,
      } as any,
    });

    return updated;
  }

  /**
   * Agrega una imagen al proyecto (usado por URL)
   */
  async addImage(
    projectId: number,
    payload: { url: string; alt: string | null; order: number },
  ) {
    await this.prisma.project.findUniqueOrThrow({ where: { id: projectId } });

    const url = (payload.url ?? '').trim();
    if (!url) throw new BadRequestException('url es requerido');

    const created = await this.prisma.projectImage.create({
      data: {
        projectId,
        url,
        alt: payload.alt,
        order: Number.isFinite(payload.order) ? payload.order : 0,
      },
    });

    return created;
  }

  /**
   * Elimina un proyecto. (Assets se eliminan por onDelete: Cascade del schema)
   */
  async remove(id: number) {
    await this.prisma.project.findUniqueOrThrow({ where: { id } });
    await this.prisma.project.delete({ where: { id } });
    return { ok: true };
  }
}

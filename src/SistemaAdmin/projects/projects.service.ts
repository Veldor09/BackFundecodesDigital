// src/SistemaAdmin/projects/projects.service.ts

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  // ===================== PROYECTOS =====================

  async list(query: any) {
    const page = Number(query.page) || 1;
    const pageSize = Number(query.pageSize) || 10;

    // incluir asignaciones (voluntarios) solo si se pide
    const includeVols =
      query.includeVols === '1' || query.includeVols === 'true';

    // saca props que no son filtro directo
    const {
      page: _p,
      pageSize: _s,
      includeVols: _iv,
      // puedes sacar aquí otros keys si no deben ir a where
      ...rest
    } = query;

    const where: any = { ...rest }; // si quieres, aquí mapeas filtros permitidos

    return this.prisma.project.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: includeVols
        ? {
            // Usamos la tabla intermedia explícita
            assignments: {
              include: {
                voluntario: {
                  select: { id: true, nombreCompleto: true, email: true },
                },
              },
              orderBy: { assignedAt: 'desc' },
            },
          }
        : undefined,
    });
  }

  async findOne(idOrSlug: string, includeVols = false) {
    const project = await this.prisma.project.findFirst({
      where: isNaN(Number(idOrSlug))
        ? { slug: idOrSlug }
        : { id: Number(idOrSlug) },
      include: {
        documents: true,
        ...(includeVols
          ? {
              assignments: {
                include: {
                  voluntario: {
                    select: { id: true, nombreCompleto: true, email: true },
                  },
                },
                orderBy: { assignedAt: 'desc' },
              },
            }
          : {}),
      },
    });

    if (!project) throw new NotFoundException('Proyecto no encontrado');
    return project;
  }

  async create(data: any) {
    const slug = data.slug || this.generateSlug(data.title);
    return this.prisma.project.create({ data: { ...data, slug } });
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-');
  }

  async update(id: number, data: any) {
    return this.prisma.project.update({ where: { id }, data });
  }

  async remove(id: number) {
    await this.prisma.project.delete({ where: { id } });
    return { message: 'Proyecto eliminado' };
  }

  async addImage(
    id: number,
    data: { url: string; alt?: string; order?: number },
  ) {
    // Implementación real pendiente (guardado en DB, etc.)
    return { message: 'Imagen agregada (sin implementación completa)', data };
  }

  // ===================== ASIGNACIONES (ProjectVolunteer) =====================

  /** Crea la asignación en la tabla intermedia (evita duplicados por PK compuesta) */
  async assignVolunteer(projectId: number, voluntarioId: number) {
    // Verifica existencia
    const [project, vol] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.voluntario.findUnique({ where: { id: voluntarioId } }),
    ]);
    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!vol) throw new NotFoundException('Voluntario no encontrado');

    try {
      await this.prisma.projectVolunteer.create({
        data: { projectId, voluntarioId }, // assignedAt tiene default(now())
      });
    } catch (e: any) {
      // P2002 = unique violation (por @@id([projectId, voluntarioId]))
      if (e?.code === 'P2002') {
        throw new BadRequestException(
          'Voluntario ya asignado a este proyecto',
        );
      }
      throw e;
    }
    return { ok: true };
  }

  /** Elimina la asignación por PK compuesta; idempotente si no existe */
  async unassignVolunteer(projectId: number, voluntarioId: number) {
    try {
      await this.prisma.projectVolunteer.delete({
        where: { projectId_voluntarioId: { projectId, voluntarioId } },
      });
    } catch (e: any) {
      // P2025 = record not found; lo tratamos como idempotente
      if (e?.code !== 'P2025') throw e;
    }
    return { ok: true };
  }

  // ===================== DOCUMENTOS =====================

  /** Lista los documentos del proyecto */
  async getProjectDocuments(projectId: number) {
    return this.prisma.projectDocument.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        url: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  /** Sube un documento (metadatos + storage) */
  async uploadProjectDocument(projectId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    // Sube al storage (ajusta según tu FilesService)
    const uploaded = await this.filesService.uploadFile(file);

    // Guarda metadatos en DB
    return this.prisma.projectDocument.create({
      data: {
        projectId,
        url: uploaded.url,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size ?? 0,
      },
      select: {
        id: true,
        url: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  /** Elimina un documento por ID */
  async removeDocumentById(projectId: number, documentId: number) {
    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.safeDeleteFromStorage(doc.url);
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

  /** Elimina un documento por nombre (compat) */
  async removeDocumentByName(projectId: number, filename: string) {
    const base = filename.includes('/') ? filename.split('/').pop() ?? '' : filename;
    const decoded = decodeURIComponent(base);

    const doc = await this.prisma.projectDocument.findFirst({
      where: { projectId, name: decoded },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.safeDeleteFromStorage(doc.url);
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

  /** Elimina un documento por URL exacta (legacy) */
  async removeDocument(projectId: number, url: string) {
    if (!url) throw new BadRequestException('url requerido');

    const doc = await this.prisma.projectDocument.findFirst({
      where: { projectId, url },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.safeDeleteFromStorage(url);
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

  /** Agrega un documento por URL (sin subir archivo) */
  async addDocument(
    id: number,
    data: { url: string; name: string; mimeType?: string; size?: number },
  ) {
    if (!data?.url) throw new BadRequestException('url requerido');
    if (!data?.name) throw new BadRequestException('name requerido');

    return this.prisma.projectDocument.create({
      data: {
        projectId: id,
        url: data.url,
        name: data.name,
        mimeType: data.mimeType || 'application/octet-stream',
        size: data.size ?? 0,
      },
      select: {
        id: true,
        url: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
  }

  // ===================== HELPERS =====================

  private async safeDeleteFromStorage(urlOrKey: string) {
    try {
      const key = this.getStorageKeyFromUrl(urlOrKey);
      await this.filesService.deleteFile(key);
    } catch (e) {
      console.error('⚠️ No se pudo eliminar del storage:', e);
    }
  }

  private getStorageKeyFromUrl(url: string): string {
    // Si ya es key cruda
    if (!url.includes('http')) return url;
    // Si es URL completa, toma el último segmento
    const last = url.split('/').pop() ?? url;
    // Ajusta si tu FilesService espera una ruta relativa
    return last;
  }
}

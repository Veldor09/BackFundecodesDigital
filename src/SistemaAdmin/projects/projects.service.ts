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

    const includeVols =
      query.includeVols === '1' || query.includeVols === 'true' || query.includeVols === true;

    // eliminar parámetros no destinados al filtro
    const { page: _p, pageSize: _s, includeVols: _iv, ...rest } = query;
    const where: any = { ...rest };

    return this.prisma.project.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: 'desc' },
      include: {
        documents: true,
        images: true,
        ...(includeVols && {
          assignments: {
            include: {
              voluntario: {
                select: {
                  id: true,
                  nombreCompleto: true,
                  email: true,
                  estado: true,
                },
              },
            },
            orderBy: { assignedAt: 'desc' },
          },
        }),
      },
    });
  }

  async findOne(idOrSlug: string, includeVols = false) {
    const project = await this.prisma.project.findFirst({
      where: isNaN(Number(idOrSlug))
        ? { slug: idOrSlug }
        : { id: Number(idOrSlug) },
      include: {
        documents: true,
        images: true,
        ...(includeVols && {
          assignments: {
            include: {
              voluntario: {
                select: {
                  id: true,
                  nombreCompleto: true,
                  email: true,
                  estado: true,
                },
              },
            },
            orderBy: { assignedAt: 'desc' },
          },
        }),
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
    return { message: 'Imagen agregada (sin implementación completa)', data };
  }

  // ===================== ASIGNACIONES (ProjectVolunteer) =====================

  async assignVolunteer(projectId: number, voluntarioId: number) {
    const [project, vol] = await Promise.all([
      this.prisma.project.findUnique({ where: { id: projectId } }),
      this.prisma.voluntario.findUnique({ where: { id: voluntarioId } }),
    ]);

    if (!project) throw new NotFoundException('Proyecto no encontrado');
    if (!vol) throw new NotFoundException('Voluntario no encontrado');

    try {
      await this.prisma.projectVolunteer.create({
        data: { projectId, voluntarioId },
      });
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException('Voluntario ya asignado a este proyecto');
      }
      throw e;
    }
    return { ok: true };
  }

  async unassignVolunteer(projectId: number, voluntarioId: number) {
    try {
      await this.prisma.projectVolunteer.delete({
        where: { projectId_voluntarioId: { projectId, voluntarioId } },
      });
    } catch (e: any) {
      if (e?.code !== 'P2025') throw e;
    }
    return { ok: true };
  }

  // ===================== DOCUMENTOS =====================

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

  async uploadProjectDocument(projectId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    const uploaded = await this.filesService.uploadFile(file);

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

  async removeDocumentById(projectId: number, documentId: number) {
    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.safeDeleteFromStorage(doc.url);
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

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
    if (!url.includes('http')) return url;
    const last = url.split('/').pop() ?? url;
    return last;
  }
}

// src/SistemaAdmin/projects/projects.service.ts

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FilesService } from '../files/files.service';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filesService: FilesService,
  ) {}

  async list(query: any) {
  const page = Number(query.page) || 1;
  const pageSize = Number(query.pageSize) || 10;

  // Elimina props que no son filtros
  const { page: _, pageSize: __, ...where } = query;

  return this.prisma.project.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
  });
}

  async findOne(idOrSlug: string) {
    const project = await this.prisma.project.findFirst({
      where: isNaN(Number(idOrSlug))
        ? { slug: idOrSlug }
        : { id: Number(idOrSlug) },
      include: { documents: true },
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

  async addImage(id: number, data: { url: string; alt?: string; order?: number }) {
    return { message: 'Imagen agregada (sin implementación completa)', data };
  }

  async getProjectDocuments(projectId: number) {
    return this.prisma.projectDocument.findMany({ where: { projectId } });
  }

  async uploadProjectDocument(projectId: number, file: Express.Multer.File) {
    const uploaded = await this.filesService.uploadFile(file);
    return this.prisma.projectDocument.create({
      data: {
        projectId,
        url: uploaded.url,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      },
    });
  }

  async removeDocument(projectId: number, url: string) {
    const doc = await this.prisma.projectDocument.findFirst({
      where: { projectId, url },
    });

    if (!doc) throw new NotFoundException('Documento no encontrado');

    await this.filesService.deleteFile(url);
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

  async addDocument(id: number, data: { url: string; name: string; mimeType?: string; size?: number }) {
  return this.prisma.projectDocument.create({
    data: {
      projectId: id,
      url: data.url,
      name: data.name,
      mimeType: data.mimeType || 'application/octet-stream',
      size: data.size || 0,
    },
  });
}
}
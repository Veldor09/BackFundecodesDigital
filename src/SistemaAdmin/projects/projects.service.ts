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

    // Elimina props que no son filtros
    const { page: _p, pageSize: _s, ...where } = query;

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

  async addImage(
    id: number,
    data: { url: string; alt?: string; order?: number },
  ) {
    // Implementación real pendiente (guardado en DB, etc.)
    return { message: 'Imagen agregada (sin implementación completa)', data };
  }

  // ===================== DOCUMENTOS =====================

  /**
   * Lista los documentos del proyecto
   */
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

  /**
   * Sube un documento (metadatos + storage)
   */
  async uploadProjectDocument(projectId: number, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');

    // Sube al storage (ajusta según tu FilesService)
    const uploaded = await this.filesService.uploadFile(file);
    // Se asume que uploadFile devuelve { url: string, key?: string }
    // Guarda metadatos en DB
    return this.prisma.projectDocument.create({
      data: {
        projectId,
        url: uploaded.url,
        name: file.originalname,
        mimeType: file.mimetype,
        size: file.size, // Asegúrate de tener este campo en tu schema si lo usas
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

  /**
   * Elimina un documento por **ID** (recomendado)
   */
  async removeDocumentById(projectId: number, documentId: number) {
    const doc = await this.prisma.projectDocument.findFirst({
      where: { id: documentId, projectId },
    });
    if (!doc) throw new NotFoundException('Documento no encontrado');

    // Borra del storage (si aplica)
    await this.safeDeleteFromStorage(doc.url);

    // Borra metadatos
    await this.prisma.projectDocument.delete({ where: { id: doc.id } });

    return { message: 'Documento eliminado' };
  }

  /**
   * Elimina un documento por **nombre de archivo** (compat)
   * filename puede venir URL-encoded o como parte de una URL.
   */
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

  /**
   * Elimina un documento por **URL** exacta (legacy). Mantener para compatibilidad.
   */
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

  /**
   * Agrega un documento por URL (sin subir archivo)
   */
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

  /**
   * Intenta borrar del storage sin romper el flujo si falla,
   * y normaliza la clave a partir de la URL pública cuando sea necesario.
   */
  private async safeDeleteFromStorage(urlOrKey: string) {
    try {
      // Si tu FilesService espera una clave (key) en vez de URL,
      // tradúcela desde la URL pública.
      const key = this.getStorageKeyFromUrl(urlOrKey);
      await this.filesService.deleteFile(key);
    } catch (e) {
      // No rompemos la eliminación en DB si el storage falla,
      // pero dejamos registro en logs del servidor:
      // eslint-disable-next-line no-console
      console.error('⚠️ No se pudo eliminar del storage:', e);
    }
  }

  /**
   * Dado una URL pública, devuelve la "key" esperada por el storage.
   * Ajusta esta lógica a tu FilesService:
   * - Si guardas directamente la "key" en `url`, devuelve tal cual.
   * - Si tu URL es tipo `https://cdn/ uploads/projects/docs/<archivo.ext>`,
   *   quizás solo necesites la última parte.
   */
  private getStorageKeyFromUrl(url: string): string {
    // Caso 1: si ya es una key cruda (no URL), devuélvela tal cual
    if (!url.includes('http')) return url;

    // Caso 2: si es una URL con path, toma el segmento final
    const last = url.split('/').pop() ?? url;

    // Si tu FilesService.deleteFile espera la ruta relativa completa:
    // return `uploads/projects/docs/${last}`;

    // Si deleteFile acepta el nombre simple:
    return last;
  }
}

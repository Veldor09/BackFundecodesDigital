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

  // eliminar parámetros no destinados al filtro
  const { page: _p, pageSize: _s, ...rest } = query;
  const where: any = { ...rest };

  return this.prisma.project.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: { createdAt: 'desc' },
    include: {
      documents: true,
      images: true,
    },
  });
}

async findOne(idOrSlug: string) {
  const project = await this.prisma.project.findFirst({
    where: isNaN(Number(idOrSlug))
      ? { slug: idOrSlug }
      : { id: Number(idOrSlug) },
    include: {
      documents: true,
      images: true,
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
  const project = await this.prisma.project.findUnique({ where: { id } });
  if (!project) throw new NotFoundException('Proyecto no encontrado');

  await (this.prisma as any).$transaction(async (tx: any) => {
    // ── 1. Eliminar registros con projectId NOT NULL (no se pueden nullificar) ──
    // Receipts primero (referencian Payment y Project)
    await tx.receipt.deleteMany({ where: { projectId: id } });
    // BillingInvoice (referencia BillingRequest y Project)
    await tx.billingInvoice.deleteMany({ where: { projectId: id } });
    // Registros contables
    await tx.programAllocation.deleteMany({ where: { projectId: id } });
    await tx.documentoContable.deleteMany({ where: { projectId: id } });
    await tx.presupuesto.deleteMany({ where: { projectId: id } });

    // ── 2. Nullificar referencias opcionales (preservar historial) ──
    // Transacciones NUNCA se borran (política contable del schema)
    await tx.transaccion.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });
    await tx.payment.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });
    await tx.billingRequest.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });
    await tx.solicitudCompra.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    // ── 3. Eliminar el proyecto ──
    // ProjectImage, ProjectDocument y ColaboradorAsignacion tienen
    // onDelete: Cascade en el schema → Prisma los elimina automáticamente.
    await tx.project.delete({ where: { id } });
  });

  return { message: 'Proyecto dado de baja correctamente' };
}

async addImage(
  id: number,
  data: { url: string; alt?: string; order?: number },
) {
  return { message: 'Imagen agregada (sin implementación completa)', data };
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

  // ===================== SALDO =====================

  async saldo(projectId: number) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, title: true, presupuestoTotal: true, monedaPresupuesto: true, cuentaId: true },
    });
    if (!project) throw new NotFoundException('Proyecto no encontrado');

    const agg = await this.prisma.transaccion.groupBy({
      by: ['tipo'],
      where: { projectId, anuladaAt: null },
      _sum: { monto: true },
    });

    const toNum = (v: any) => (v ? Number(v.toString()) : 0);
    const presupuesto = toNum(project.presupuestoTotal);
    const ingresos = toNum(agg.find((g: any) => g.tipo === 'ingreso')?._sum?.monto);
    const egresos = toNum(agg.find((g: any) => g.tipo === 'egreso')?._sum?.monto);
    const disponible = presupuesto + ingresos - egresos;
    const efectivo = presupuesto + ingresos;
    const porcentajeUtilizado = efectivo > 0
      ? Math.min(100, (egresos / efectivo) * 100)
      : 0;

    return {
      id: project.id,
      nombre: project.title,
      moneda: project.monedaPresupuesto,
      presupuestoTotal: presupuesto,
      ingresos,
      egresos,
      ejecutado: egresos,
      disponible,
      porcentajeUtilizado: Number(porcentajeUtilizado.toFixed(2)),
    };
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

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class DocumentosService {
  constructor(private prisma: PrismaService) {}

  private async ensureProject(projectId: number) {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new BadRequestException('Proyecto no existe');
  }

  async create(meta: { projectId: number; proyecto: string; mes: number; anio: number; }, file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido');
    if (file.size > 10 * 1024 * 1024) throw new BadRequestException('El archivo excede 10MB');

    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    if (!allowed.includes(file.mimetype)) throw new BadRequestException('Tipo de archivo no permitido');

    await this.ensureProject(meta.projectId);

    return this.prisma.documentoContable.create({
      data: {
        projectId: meta.projectId,
        proyecto: meta.proyecto,
        mes: meta.mes,
        anio: meta.anio,
        nombre: file.originalname,
        tipoMime: file.mimetype,
        bytes: file.size,
        url: `/uploads/accounting/${file.filename}`,
      },
    });
  }

  async findAll(filters: { projectId?: number; mes?: number; anio?: number }) {
    return this.prisma.documentoContable.findMany({
      where: {
        projectId: filters.projectId,
        mes: filters.mes,
        anio: filters.anio,
      },
      orderBy: [{ anio: 'desc' }, { mes: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async remove(id: string) {
    const exists = await this.prisma.documentoContable.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Documento no encontrado');
    await this.prisma.documentoContable.delete({ where: { id } });
    return { deleted: true };
  }
}

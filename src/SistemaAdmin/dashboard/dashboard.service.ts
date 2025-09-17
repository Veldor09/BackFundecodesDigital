import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getMetrics() {
    try {
      // Proyectos por estado
      const [totalProjects, activeProjects, draftProjects, finishedProjects] =
        await Promise.all([
          this.prisma.project.count(),
          this.prisma.project.count({ where: { published: true } }),
          this.prisma.project.count({ where: { published: false } }),
          this.prisma.project.count({ where: { status: 'FINALIZADO' } }),
        ]);

      // Archivos
      const [totalFiles, lastFile] = await Promise.all([
        this.prisma.projectDocument.count(),
        this.prisma.projectDocument.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true, name: true },
        }),
      ]);

      // Imágenes
      const totalImages = await this.prisma.projectImage.count();

      // Voluntarios (últimos 30 días)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const [totalVolunteers, recentVolunteers] = await Promise.all([
        this.prisma.volunteer.count(),
        this.prisma.volunteer.count({
          where: { createdAt: { gte: thirtyDaysAgo } },
        }),
      ]);

      // Mensajes de contacto
      const [totalContactMessages, lastActivity] = await Promise.all([
        this.prisma.contactMessage.count(),
        this.prisma.contactMessage.findFirst({
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true },
        }),
      ]);

      // Calcular recapitulación de actividades del mes
      const currentMonth = new Date();
      currentMonth.setDate(1);
      currentMonth.setHours(0, 0, 0, 0);

      const monthlyActivities = await this.prisma.project.count({
        where: {
          updatedAt: { gte: currentMonth },
        },
      });

      return {
        // Métricas principales
        metrics: {
          users: {
            total: totalVolunteers,
            label: 'Usuarios',
          },
          projects: {
            total: totalProjects,
            active: activeProjects,
            draft: draftProjects,
            finished: finishedProjects,
            label: 'Proyectos',
          },
          files: {
            total: totalFiles + totalImages, // Total archivos (documentos + imágenes)
            documents: totalFiles,
            images: totalImages,
            lastUpload: lastFile
              ? {
                  name: lastFile.name,
                  date: lastFile.createdAt,
                }
              : null,
            label: 'Archivos',
          },
          volunteering: {
            total: totalVolunteers,
            thisMonth: recentVolunteers,
            label: 'Voluntariado',
          },
          accounting: {
            // Placeholder - necesitarás implementar modelos de contabilidad
            total: 0,
            label: 'Contabilidad',
          },
          billing: {
            // Placeholder - necesitarás implementar modelos de facturación
            total: 0,
            label: 'Facturación',
          },
        },
        // Recapitulación de actividades
        recap: {
          monthlyActivities,
          lastActivity: lastActivity?.createdAt || null,
        },
        // Accesos rápidos
        quickAccess: [
          {
            name: 'Gestión de Voluntariado',
            href: '/admin/voluntariado',
            icon: 'handshake',
          },
          { name: 'Contabilidad', href: '/admin/contabilidad', icon: 'wallet' },
          {
            name: 'Colaboradores',
            href: '/admin/colaboradores',
            icon: 'users',
          },
          { name: 'Facturación', href: '/admin/facturacion', icon: 'receipt' },
          {
            name: 'Recapitulación',
            href: '/admin/recapitulacion',
            icon: 'bar-chart',
          },
        ],
        // Timestamp para caché
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Corrección: asegurar que error sea tipo Error
      if (error instanceof Error) {
        throw new Error(`Error al obtener métricas: ${error.message}`);
      } else {
        throw new Error('Error desconocido al obtener métricas');
      }
    }
  }

  async getProjectStats() {
    try {
      const stats = await this.prisma.project.groupBy({
        by: ['status'],
        _count: true,
      });

      const byCategory = await this.prisma.project.groupBy({
        by: ['category'],
        _count: true,
      });

      const byArea = await this.prisma.project.groupBy({
        by: ['area'],
        _count: true,
      });

      return {
        byStatus: stats,
        byCategory,
        byArea,
      };
    } catch (error) {
      // Corrección: asegurar que error sea tipo Error
      if (error instanceof Error) {
        throw new Error(`Error al obtener estadísticas: ${error.message}`);
      } else {
        throw new Error('Error desconocido al obtener estadísticas');
      }
    }
  }
}

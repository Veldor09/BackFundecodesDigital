import { Controller, Get, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { CacheInterceptor, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('dashboard')
@Controller('dashboard')
@UseInterceptors(CacheInterceptor)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('metrics')
  @ApiOperation({ summary: 'Obtener métricas generales del dashboard' })
  @ApiResponse({ 
    status: 200, 
    description: 'Métricas obtenidas exitosamente',
    schema: {
      type: 'object',
      properties: {
        metrics: {
          type: 'object',
          properties: {
            users: { type: 'object' },
            projects: { type: 'object' },
            files: { type: 'object' },
            volunteering: { type: 'object' },
            accounting: { type: 'object' },
            billing: { type: 'object' }
          }
        },
        recap: { type: 'object' },
        quickAccess: { type: 'array' },
        timestamp: { type: 'string' }
      }
    }
  })
  @CacheTTL(30000) // 30 segundos de caché
  async getMetrics() {
    return this.dashboardService.getMetrics();
  }

  @Get('stats/projects')
  @ApiOperation({ summary: 'Obtener estadísticas de proyectos' })
  @ApiResponse({ status: 200, description: 'Estadísticas obtenidas' })
  @CacheTTL(60000) // 1 minuto de caché
  async getProjectStats() {
    return this.dashboardService.getProjectStats();
  }
}
import {
  Controller,
  Get,
  Query,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportesService } from './reportes.service';
import { FiltroInformeDto } from './dto/filtro-informe.dto';
import { ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /* ============================================================
     📦 Exportar informes PDF o Excel (versión estable)
  ============================================================ */
  @Get('exportar')
  @ApiQuery({
    name: 'periodo',
    required: true,
    description: 'Tipo de periodo (ANIO o RANGO)',
    example: 'RANGO',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    description: 'Año a consultar (solo si periodo=ANIO)',
    example: 2025,
  })
  @ApiQuery({
    name: 'fechaInicio',
    required: false,
    description: 'Fecha inicial del rango (solo si periodo=RANGO)',
    example: '2024-01-01',
  })
  @ApiQuery({
    name: 'fechaFin',
    required: false,
    description: 'Fecha final del rango (solo si periodo=RANGO)',
    example: '2025-12-31',
  })
  @ApiQuery({
    name: 'tipoReporte',
    required: true,
    description: 'Tipo de agrupación: Mensual, Trimestral, Cuatrimestral, Semestral, Anual',
    example: 'Mensual',
  })
  @ApiQuery({
    name: 'modulos',
    required: true,
    description: 'Lista separada por comas con los módulos a incluir en el informe',
    example: 'projects,billing,solicitudes,collaborators,volunteers',
  })
  @ApiQuery({
    name: 'formato',
    required: true,
    description: 'Formato de salida: pdf o excel',
    example: 'pdf',
  })
  async exportarInforme(@Query() query: any, @Res() res: Response) {
    try {
      // === 1️⃣ Normalizar módulos ===
      let modulos: string[] = [];

      if (typeof query.modulos === 'string') {
        modulos = query.modulos
          .split(',')
          .map((m) => m.trim())
          .filter((m) => m.length > 0);
      } else if (Array.isArray(query.modulos)) {
        modulos = query.modulos;
      } else {
        // Por defecto todos los módulos
        modulos = [
          'projects',
          'billing',
          'solicitudes',
          'collaborators',
          'volunteers',
        ];
      }

      // === 2️⃣ Generar datos base ===
      const filtros = { ...query, modulos };
      const data = await this.reportesService.generarInforme(filtros);

      // === 3️⃣ Exportar según formato ===
      const formato = (query.formato || 'pdf').toLowerCase();

      if (formato === 'pdf') {
        const buffer = await this.reportesService.generarPdf(data);

        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="informe-fundecodes-${new Date()
            .toISOString()
            .split('T')[0]}.pdf"`,
          'Content-Length': buffer.length,
        });

        return res.end(buffer);
      }

      if (['xlsx', 'excel', 'xls'].includes(formato)) {
        const buffer = await this.reportesService.generarExcel(data);

        res.set({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="informe-fundecodes-${new Date()
            .toISOString()
            .split('T')[0]}.xlsx"`,
          'Content-Length': buffer.length,
        });

        return res.end(buffer);
      }

      throw new BadRequestException(`Formato "${query.formato}" no soportado. Usa 'pdf' o 'excel'.`);
    } catch (error) {
      console.error('❌ Error interno al exportar el informe:', error);
      throw new BadRequestException('Error interno del servidor al exportar el informe.');
    }
  }
}

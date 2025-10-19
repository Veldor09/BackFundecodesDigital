import {
  Controller,
  Get,
  Query,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { ReportesService } from './reportes.service';
import { FiltroInformeDto } from './dto/filtro-informe.dto';
import { FiltroExportDto } from './dto/filtro-export.dto';
import { TipoFormato } from './dto/filtro-export.dto';

@ApiTags('Reportes')
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /* ============================================================
     📊 GENERAR INFORME ANUAL O POR RANGO
  ============================================================ */
  @Get('informe-anual')
  @ApiOperation({
    summary: '📊 Generar informe anual o por rango de fechas',
    description:
      'Devuelve datos consolidados por módulos (projects, billing, contabilidad, solicitudes, volunteer, etc.) agrupados según el tipo de reporte: Mensual, Trimestral, Semestral o Anual.',
  })
  @ApiQuery({
    name: 'modulos',
    required: true,
    description:
      'Lista separada por comas con los módulos a incluir en el informe.',
    example: 'projects,billing,solicitudes',
  })
  @ApiQuery({
    name: 'tipoReporte',
    required: true,
    description: 'Tipo de agrupación temporal del informe.',
    enum: ['Mensual', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual'],
    example: 'Anual',
  })
  @ApiQuery({
    name: 'periodo',
    required: true,
    description: 'Tipo de periodo a consultar: "año" o "rango".',
    enum: ['año', 'rango'],
    example: 'año',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    description: 'Año del informe (solo obligatorio si el periodo = "año").',
    example: 2024,
    type: Number,
  })
  @ApiQuery({
    name: 'fechaInicio',
    required: false,
    description:
      'Fecha inicial del rango (solo si periodo = "rango"). Formato: YYYY-MM-DD',
    example: '2024-01-01',
    type: String,
  })
  @ApiQuery({
    name: 'fechaFin',
    required: false,
    description:
      'Fecha final del rango (solo si periodo = "rango"). Formato: YYYY-MM-DD',
    example: '2024-12-31',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Informe generado correctamente.',
    schema: {
      example: {
        success: true,
        message: 'Informe generado correctamente.',
        data: {
          filtros: {
            periodo: 'año',
            anio: 2024,
            tipoReporte: 'Anual',
            modulos: ['projects', 'billing', 'solicitudes'],
          },
          totalRegistros: 42,
          detalles: {
            projects: { total: 12, grupos: { 'Año completo': 12 } },
            billing: { total: 15, grupos: { 'Año completo': 15 } },
            solicitudes: { total: 15, grupos: { 'Año completo': 15 } },
          },
        },
      },
    },
  })
  async obtenerInforme(@Query() filtros: FiltroInformeDto) {
    try {
      const data = await this.reportesService.generarInforme(filtros);
      return {
        success: true,
        message: 'Informe generado correctamente.',
        data,
      };
    } catch (error: unknown) {
      console.error('❌ Error al generar informe:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error interno del servidor al generar el informe.',
        error: error instanceof Error ? error.message : 'UNKNOWN',
      });
    }
  }

  /* ============================================================
     🧾 EXPORTAR INFORME (PDF o EXCEL)
  ============================================================ */
  @Get('exportar')
  @ApiOperation({
    summary: '🧾 Exportar informe en PDF o Excel',
    description:
      'Genera un archivo PDF institucional o una hoja Excel con los resultados del informe anual/rango.',
  })
  @ApiQuery({
    name: 'formato',
    required: true,
    enum: ['pdf', 'excel'],
    description: 'Formato de exportación: "pdf" o "excel".',
    example: 'pdf',
  })
  @ApiQuery({
    name: 'modulos',
    required: true,
    description:
      'Lista separada por comas con los módulos a incluir en el informe.',
    example: 'projects,billing,solicitudes',
  })
  @ApiQuery({
    name: 'tipoReporte',
    required: true,
    description: 'Tipo de agrupación temporal del informe.',
    enum: ['Mensual', 'Trimestral', 'Cuatrimestral', 'Semestral', 'Anual'],
    example: 'Anual',
  })
  @ApiQuery({
    name: 'periodo',
    required: true,
    description: 'Tipo de periodo a consultar: "año" o "rango".',
    enum: ['año', 'rango'],
    example: 'año',
  })
  @ApiQuery({
    name: 'anio',
    required: false,
    description: 'Año del informe (solo obligatorio si el periodo = "año").',
    example: 2024,
    type: Number,
  })
  @ApiQuery({
    name: 'fechaInicio',
    required: false,
    description:
      'Fecha inicial del rango (solo si periodo = "rango"). Formato: YYYY-MM-DD',
    example: '2024-01-01',
    type: String,
  })
  @ApiQuery({
    name: 'fechaFin',
    required: false,
    description:
      'Fecha final del rango (solo si periodo = "rango"). Formato: YYYY-MM-DD',
    example: '2024-12-31',
    type: String,
  })
  async exportarInforme(
    @Query() filtros: FiltroExportDto,
    @Res() res: Response,
  ) {
    try {
      const data = await this.reportesService.generarInforme(filtros);

      if (filtros.formato === TipoFormato.PDF) {
        const pdfBuffer = await this.reportesService.generarPdf(data);
        res.set({
          'Content-Type': 'application/pdf',
          'Content-Disposition':
            'attachment; filename="informe-fundecodes.pdf"',
        });
        res.send(pdfBuffer);
      } else if (filtros.formato === TipoFormato.EXCEL) {
        const excelBuffer = await this.reportesService.generarExcel(data);
        res.set({
          'Content-Type':
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition':
            'attachment; filename="informe-fundecodes.xlsx"',
        });
        res.send(excelBuffer);
      } else {
        throw new BadRequestException('Formato no soportado.');
      }
    } catch (error: unknown) {
      console.error('❌ Error al exportar informe:', error);
      throw new BadRequestException({
        success: false,
        message: 'Error interno del servidor al exportar el informe.',
        error: error instanceof Error ? error.message : 'UNKNOWN',
      });
    }
  }
}

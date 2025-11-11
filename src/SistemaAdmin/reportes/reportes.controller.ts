import {
  Controller,
  Get,
  Query,
  Res,
  Req,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { Response, Request } from 'express';
import { ReportesService } from './reportes.service';
import { ApiQuery, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; 
import { FiltroInformeDto } from './dto/filtro-informe.dto';

@ApiTags('Reportes')
@ApiBearerAuth('bearer') // 👈 Swagger reconocerá el JWT Bearer token
@Controller('reportes')
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  /* ============================================================
     📊 Obtener datos del informe en formato JSON (vista previa)
  ============================================================ */
  @Get('datos')
  @ApiQuery({
    name: 'periodo',
    required: true,
    description: 'Tipo de periodo (ANIO o RANGO)',
    example: 'ANIO',
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
    description:
      'Tipo de agrupación: Mensual, Trimestral, Cuatrimestral, Semestral o Anual',
    example: 'Mensual',
  })
  @ApiQuery({
    name: 'modulos',
    required: true,
    description:
      'Lista separada por comas con los módulos a incluir en el informe',
    example: 'projects,billing,solicitudes,collaborators,volunteers',
  })
  @ApiResponse({
    status: 200,
    description: 'Datos consolidados del informe en formato JSON.',
  })
  async obtenerDatos(@Query() query: FiltroInformeDto) {
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

      // === 3️⃣ Retornar datos JSON ===
      return { success: true, ...data };
    } catch (error) {
      console.error('❌ Error al obtener datos del informe:', error);
      throw new BadRequestException('Error al obtener los datos del informe.');
    }
  }

  /* ============================================================
     📦 Exportar informes (PDF / Excel) + Guardado + Auditoría
  ============================================================ */
  @UseGuards(JwtAuthGuard)
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
    description:
      'Tipo de agrupación: Mensual, Trimestral, Cuatrimestral, Semestral o Anual',
    example: 'Mensual',
  })
  @ApiQuery({
    name: 'modulos',
    required: true,
    description:
      'Lista separada por comas con los módulos a incluir en el informe',
    example: 'projects,billing,solicitudes,collaborators,volunteers',
  })
  @ApiQuery({
    name: 'formato',
    required: true,
    description: 'Formato de salida: pdf o excel',
    example: 'pdf',
  })
  @ApiResponse({
    status: 200,
    description:
      'Devuelve el archivo PDF o Excel generado, guardado y auditado.',
  })
  async exportarInforme(
    @Query() query: any,
    @Req() req: Request,
    @Res() res: Response,
  ) {
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

            // === 3️⃣ Determinar formato y usuario autenticado ===
      const formato = (query.formato || 'pdf').toLowerCase();

      // ⚡ Obtener usuario desde JWT
      const user = req.user as { sub: number; email: string } | undefined;

      if (!user || !user.sub) {
        console.error('❌ No se pudo determinar el usuario autenticado:', user);
        throw new BadRequestException('No se pudo determinar el usuario autenticado.');
      }

      const userId = user.sub;
      console.log(`👤 Usuario autenticado: ${user.email} (id=${userId})`);


      // === 4️⃣ Generar, guardar y auditar ===
      const resultado = await this.reportesService.generarGuardarAuditar(
        formato,
        data,
        userId,
      );

      // === 5️⃣ Preparar y enviar respuesta ===
      const { buffer, filename } = resultado;

      const mime =
        formato === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      if (!buffer?.length) {
        throw new BadRequestException(
          'No se generó correctamente el archivo del informe.',
        );
      }

      if (!filename) {
        throw new BadRequestException(
          'Falta el nombre del archivo en el informe generado.',
        );
      }

      // Headers HTTP
      res.set({
        'Content-Type': mime,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length,
      });

      // Enviar archivo
      return res.end(buffer);
    } catch (err: unknown) {
      const error = err as Error;
      console.error('❌ ERROR DETALLADO AL EXPORTAR INFORME:', error);

      throw new BadRequestException({
        message: 'Error interno del servidor al exportar el informe.',
        detalle: error.message || 'Error desconocido al generar el informe.',
        stack: error.stack,
      });
    }
  }
}

// src/SistemaAdmin/solicitudes/solicitudes.controller.ts
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
  Req,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Request } from 'express';

import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

// Swagger
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';

// ⬇️ Guards y permisos (ajusta los paths si cambian tus carpetas)
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Solicitudes')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('solicitudes:access')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  // =====================================================
  // 🔹 CREAR SOLICITUD
  // =====================================================
  @Post()
  @ApiOperation({ summary: 'Crear una nueva solicitud con archivos adjuntos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', example: 'Compra de materiales' },
        descripcion: { type: 'string', example: 'Necesito papelería para oficina' },
        usuarioId: { type: 'integer', example: 3, nullable: true },
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['titulo', 'descripcion'],
    },
  })
  @ApiCreatedResponse({ description: 'Solicitud creada exitosamente' })
  @UseInterceptors(
    FilesInterceptor('archivos', 10, {
      storage: diskStorage({
        destination: './uploads/solicitudes',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  create(
    @Body() dto: CreateSolicitudDto,
    @UploadedFiles() archivos: Express.Multer.File[],
    @Req() req: Request & { user?: { id?: number; userId?: number } },
  ) {
    const usuarioId = dto.usuarioId ?? req.user?.userId ?? req.user?.id ?? null;
    const paths = archivos?.map((f) => `/uploads/solicitudes/${f.filename}`) ?? [];
    return this.solicitudesService.create(dto, paths, usuarioId ?? undefined);
  }

  // =====================================================
  // 🔹 LISTAR TODAS LAS SOLICITUDES
  // =====================================================
  @Get()
  @ApiOperation({ summary: 'Listar todas las solicitudes' })
  @ApiOkResponse({ description: 'Listado de solicitudes', isArray: true })
  findAll() {
    return this.solicitudesService.findAll();
  }

  // =====================================================
  // 🔹 HISTORIAL DE CAMBIOS (ruta específica ANTES de :id)
  // =====================================================
  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial de cambios de una solicitud' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Historial de la solicitud', isArray: true })
  historial(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.historial(id);
  }

  // =====================================================
  // 🔹 OBTENER SOLICITUD POR ID
  // =====================================================
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una solicitud por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Solicitud encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.solicitudesService.findOne(id);
  }

  // =====================================================
  // 🔹 VALIDAR / DEVOLVER (CONTADORA)
  // =====================================================
  @Patch(':id/validar')
  @ApiOperation({ summary: 'Validar o devolver solicitud (contadora)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estadoContadora: {
          type: 'string',
          enum: ['VALIDADA', 'PENDIENTE', 'DEVUELTA'],
          example: 'VALIDADA',
        },
        comentarioContadora: {
          type: 'string',
          example: 'La factura tiene respaldo correcto.',
          nullable: true,
        },
      },
      required: ['estadoContadora'],
    },
  })
  @ApiOkResponse({ description: 'Decisión de contadora registrada' })
  validarSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body('estadoContadora') estadoContadora: 'VALIDADA' | 'PENDIENTE' | 'DEVUELTA',
    @Body('comentarioContadora') comentarioContadora: string | undefined,
    @Req() req: Request & { user?: { id?: number; userId?: number } },
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? undefined;
    return this.solicitudesService.validarPorContadora(
      id,
      estadoContadora,
      comentarioContadora ?? null,
      userId,
    );
  }

  // =====================================================
  // 🔹 DECISIÓN DEL DIRECTOR
  // =====================================================
  @Patch(':id/decision-director')
  @ApiOperation({ summary: 'Aprobación o rechazo por director' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estadoDirector: {
          type: 'string',
          enum: ['APROBADA', 'RECHAZADA'],
          example: 'APROBADA',
        },
        comentarioDirector: {
          type: 'string',
          example: 'Se aprueba la compra de materiales.',
          nullable: true,
        },
      },
      required: ['estadoDirector'],
    },
  })
  @ApiOkResponse({ description: 'Decisión del director registrada' })
  decisionDirector(
    @Param('id', ParseIntPipe) id: number,
    @Body('estadoDirector') estadoDirector: 'APROBADA' | 'RECHAZADA',
    @Body('comentarioDirector') comentarioDirector: string | undefined,
    @Req() req: Request & { user?: { id?: number; userId?: number } },
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? undefined;
    return this.solicitudesService.decisionDirector(
      id,
      estadoDirector,
      comentarioDirector ?? null,
      userId,
    );
  }
}

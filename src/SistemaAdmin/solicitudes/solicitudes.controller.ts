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
} from '@nestjs/swagger';

@ApiTags('Solicitudes')
@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly solicitudesService: SolicitudesService) {}

  /* --------------  CREAR SOLICITUD  -------------- */
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
    @Req() req: Request & { user?: { id?: number } },
  ) {
    const usuarioId = dto.usuarioId ?? req.user?.id ?? null;
    const paths = archivos?.map((f) => `/uploads/solicitudes/${f.filename}`) ?? [];
    return this.solicitudesService.create(dto, paths, usuarioId ?? undefined);
  }

  /* --------------  LISTAR TODAS  -------------- */
  @Get()
  @ApiOperation({ summary: 'Listar todas las solicitudes' })
  @ApiOkResponse({ description: 'Listado de solicitudes', isArray: true })
  findAll() {
    return this.solicitudesService.findAll();
  }

  /* --------------  OBTENER POR ID  -------------- */
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una solicitud por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Solicitud encontrada' })
  findOne(@Param('id') id: string) {
    return this.solicitudesService.findOne(+id);
  }

  /* --------------  HISTORIAL  -------------- */
  @Get(':id/historial')
  @ApiOperation({ summary: 'Historial de cambios de una solicitud' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Historial', isArray: true })
  historial(@Param('id') id: string) {
    return this.solicitudesService.historial(+id);
  }

  /* --------------  CAMBIAR ESTADO GENERAL  -------------- */
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Actualizar estado de una solicitud' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'VALIDADA'],
          example: 'APROBADA',
        },
      },
      required: ['estado'],
    },
  })
  @ApiOkResponse({ description: 'Estado actualizado' })
  updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'VALIDADA',
  ) {
    const userId = 1; // temporal (hasta tener JWT)
    return this.solicitudesService.updateEstado(+id, estado, userId ?? undefined);
  }

  /* --------------  VALIDAR POR CONTADORA (con comentario) -------------- */
  @Patch(':id/validar')
  @ApiOperation({ summary: 'Validar solicitud por contadora (con comentario opcional)' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        comentarioContadora: { type: 'string', example: 'Documentos verificados', nullable: true },
      },
    },
  })
  @ApiOkResponse({ description: 'Solicitud validada por contadora' })
  validarSolicitud(
    @Param('id') id: string,
    @Body('comentarioContadora') comentarioContadora?: string,
  ) {
    const userId = 1; // temporal
    return this.solicitudesService.validarPorContadora(+id, comentarioContadora ?? null, userId ?? undefined);
  }

  /* --------------  DECISIÓN DIRECTOR -------------- */
  @Patch(':id/decision-director')
  @ApiOperation({ summary: 'Aprobación o rechazo por director con comentario' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['APROBADA', 'RECHAZADA'],
          example: 'APROBADA',
        },
        comentarioDirector: { type: 'string', example: 'Se aprueba la compra', nullable: true },
      },
      required: ['estado'],
    },
  })
  @ApiOkResponse({ description: 'Decisión del director registrada' })
  decisionDirector(
    @Param('id') id: string,
    @Body('estado') estado: 'APROBADA' | 'RECHAZADA',
    @Body('comentarioDirector') comentarioDirector?: string,
  ) {
    const userId = 1; // temporal
    return this.solicitudesService.decisionDirector(+id, estado, comentarioDirector ?? null, userId ?? undefined);
  }
}

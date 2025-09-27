import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';

import { SolicitudesService } from './solicitudes.service';
import { CreateSolicitudDto } from './dto/create-solicitud.dto';

// Swagger decorators
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

  // ---------------- CREAR SOLICITUD ----------------
  @Post()
  @ApiOperation({ summary: 'Crear una nueva solicitud con archivos adjuntos' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        titulo: { type: 'string', example: 'Compra de materiales' },
        descripcion: {
          type: 'string',
          example: 'Necesito papelería para oficina',
        },
        archivos: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
      required: ['titulo', 'descripcion'],
    },
  })
  @ApiCreatedResponse({
    description: 'Solicitud creada exitosamente',
  })
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
  ) {
    const paths =
      archivos?.map((f) => `/uploads/solicitudes/${f.filename}`) ?? [];
    return this.solicitudesService.create(dto, paths);
  }

  // ---------------- LISTAR TODAS ----------------
  @Get()
  @ApiOperation({ summary: 'Listar todas las solicitudes' })
  @ApiOkResponse({
    description: 'Listado de solicitudes',
    isArray: true,
  })
  findAll() {
    return this.solicitudesService.findAll();
  }

  // ---------------- OBTENER POR ID ----------------
  @Get(':id')
  @ApiOperation({ summary: 'Obtener una solicitud por ID' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Solicitud encontrada' })
  findOne(@Param('id') id: string) {
    return this.solicitudesService.findOne(+id);
  }

  // ---------------- CAMBIAR ESTADO ----------------
  @Patch(':id/estado')
  @ApiOperation({ summary: 'Actualizar estado de una solicitud' })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        estado: {
          type: 'string',
          enum: ['PENDIENTE', 'APROBADA', 'RECHAZADA'],
          example: 'APROBADA',
        },
      },
      required: ['estado'],
    },
  })
  @ApiOkResponse({ description: 'Estado actualizado correctamente' })
  updateEstado(
    @Param('id') id: string,
    @Body('estado') estado: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA',
  ) {
    return this.solicitudesService.updateEstado(+id, estado);
  }
}

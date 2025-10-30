// src/SistemaAdmin/contabilidad/documentos/documentos.controller.ts
import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  UseInterceptors,
  UploadedFile,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiBody, ApiTags, ApiQuery } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import type { Request } from 'express';
import { DocumentosService } from './documentos.service';
import { CreateDocumentoDto } from './dto/create-documento.dto';

// ⬇️ Guards y permisos (ajusta rutas si fuera necesario)
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

// ✔️ Firma correcta del callback: (error: Error | null, filename: string) => void
function fileName(
  req: Request,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) {
  const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
  callback(null, safe);
}

@ApiTags('Contabilidad - Documentos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('contabilidad:access')
@Controller('contabilidad/documentos')
export class DocumentosController {
  constructor(private service: DocumentosService) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: 'uploads/accounting',
        filename: fileName,
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      // ✔️ fileFilter con 2 args en el callback
      fileFilter: (
        req: Request,
        file: Express.Multer.File,
        cb: (error: Error | null, acceptFile: boolean) => void,
      ) => {
        const allowed = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ];
        if (!allowed.includes(file.mimetype)) {
          return cb(new Error('Tipo no permitido'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer' },
        proyecto: { type: 'string' },
        mes: { type: 'integer', minimum: 1, maximum: 12 },
        anio: { type: 'integer' },
        file: { type: 'string', format: 'binary' },
      },
      required: ['projectId', 'proyecto', 'mes', 'anio', 'file'],
    },
  })
  upload(@UploadedFile() file: Express.Multer.File, @Body() dto: CreateDocumentoDto) {
    return this.service.create(dto, file);
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiQuery({ name: 'mes', required: false, type: Number })
  @ApiQuery({ name: 'anio', required: false, type: Number })
  findAll(@Query('projectId') projectId?: string, @Query('mes') mes?: string, @Query('anio') anio?: string) {
    return this.service.findAll({
      projectId: projectId ? Number(projectId) : undefined,
      mes: mes ? Number(mes) : undefined,
      anio: anio ? Number(anio) : undefined,
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}

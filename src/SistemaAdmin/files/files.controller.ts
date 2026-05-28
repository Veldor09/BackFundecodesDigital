// src/SistemaAdmin/files/files.controller.ts
import {
  Controller,
  Post,
  Delete,
  Body,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Archivos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard)
@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ================================================================
  // SUBIR ARCHIVO → Cloudflare R2
  // ================================================================
  @Post('upload')
  @ApiOperation({ summary: 'Subir archivo a Cloudflare R2 y obtener URL pública' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        folder: { type: 'string', example: 'projects', description: 'Carpeta destino (uploads, projects, receipts, etc.)' },
      },
      required: ['file'],
    },
  })
  @ApiQuery({ name: 'folder', required: false, description: 'Carpeta destino en R2' })
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('folder') folder?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.filesService.uploadFile(file, folder ?? 'uploads');
  }

  // ================================================================
  // ELIMINAR ARCHIVO por URL pública
  // ================================================================
  @Delete('delete')
  @ApiOperation({ summary: 'Eliminar archivo de R2 por su URL pública' })
  async deleteFile(@Body('url') url: string) {
    if (!url) throw new BadRequestException('URL requerida');
    return this.filesService.deleteFile(url);
  }

  // ================================================================
  // ELIMINAR ARCHIVO por key de bucket
  // ================================================================
  @Delete('delete-by-key')
  @ApiOperation({ summary: 'Eliminar archivo de R2 por su key (ruta interna)' })
  async deleteByKey(@Body('key') key: string) {
    if (!key) throw new BadRequestException('Key requerido');
    return this.filesService.deleteFileByKey(key);
  }
}

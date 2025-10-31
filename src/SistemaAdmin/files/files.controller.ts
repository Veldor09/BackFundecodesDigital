import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  Delete,
  Body,
  Get,
  Param,
  Res,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { Response } from 'express';
import { join } from 'path';
import * as fs from 'fs';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ================================================================
  // 🟢 SUBIR ARCHIVO
  // ================================================================
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.filesService.uploadFile(file);
  }

  // ================================================================
  // 🔴 ELIMINAR ARCHIVO
  // ================================================================
  @Delete('delete')
  async deleteFile(@Body('url') url: string) {
    return this.filesService.deleteFile(url);
  }

  // ================================================================
  // 🔍 INFO ARCHIVO
  // ================================================================
  @Get('info/:filename')
  async getFileInfo(@Param('filename') filename: string) {
    const fileUrl = `/uploads/${filename}`;
    return this.filesService.getFileInfo(fileUrl);
  }

  // ================================================================
  // 📥 DESCARGAR ARCHIVO
  // ================================================================
  @Get('download/:filename')
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    try {
      // Busca el archivo en múltiples rutas posibles
      const uploadsDir = join(process.cwd(), 'uploads');
      const possiblePaths = [
        join(uploadsDir, filename),
        join(uploadsDir, 'projects', filename),
        join(uploadsDir, 'projects', 'docs', filename),
      ];

      const existingPath = possiblePaths.find((p) => fs.existsSync(p));

      if (!existingPath) {
        return res.status(404).json({ message: 'Archivo no encontrado' });
      }

      res.set({
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/octet-stream',
      });

      const fileStream = fs.createReadStream(existingPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Error al descargar archivo:', error);
      res.status(500).json({ message: 'Error al descargar archivo' });
    }
  }

  // ================================================================
  // 👁️ PREVISUALIZAR ARCHIVO
  // ================================================================
  @Get('preview/:filename')
  async previewFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      // Busca el archivo en múltiples rutas posibles
      const uploadsDir = join(process.cwd(), 'uploads');
      const possiblePaths = [
        join(uploadsDir, filename),
        join(uploadsDir, 'projects', filename),
        join(uploadsDir, 'projects', 'docs', filename),
      ];

      const existingPath = possiblePaths.find((p) => fs.existsSync(p));

      if (!existingPath) {
        return res.status(404).json({ message: 'Archivo no encontrado' });
      }

      // Detectar tipo MIME según extensión
      const ext = filename.split('.').pop()?.toLowerCase();
      const mimeTypes: Record<string, string> = {
        pdf: 'application/pdf',
        jpg: 'image/jpeg',
        jpeg: 'image/jpeg',
        png: 'image/png',
        gif: 'image/gif',
        txt: 'text/plain',
      };

      const contentType = mimeTypes[ext ?? ''] || 'application/octet-stream';

      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
      });

      const fileStream = fs.createReadStream(existingPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('❌ Error al previsualizar archivo:', error);
      res.status(500).json({ message: 'Error al previsualizar archivo' });
    }
  }
}

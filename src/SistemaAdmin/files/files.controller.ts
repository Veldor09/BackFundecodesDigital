import { Controller, Post, UploadedFile, UseInterceptors, Delete, Body, Get, Param, Res } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { Response } from 'express';
import { createReadStream } from 'fs';
import { join } from 'path';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    return this.filesService.uploadFile(file);
  }

  @Delete('delete')
  async deleteFile(@Body('url') url: string) {
    return this.filesService.deleteFile(url);
  }

  @Get('info/:filename')
  async getFileInfo(@Param('filename') filename: string) {
    const fileUrl = `/uploads/${filename}`;
    return this.filesService.getFileInfo(fileUrl);
  }

  @Get('download/:filename')
  async downloadFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const filePath = join(process.cwd(), 'uploads', filename);
      const fileStream = createReadStream(filePath);
      
      res.set({
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/octet-stream',
      });
      
      fileStream.pipe(res);
    } catch (error) {
      // ➡️ CORRECCIÓN: Manejo de error unknown
      if (error instanceof Error && error.message.includes('ENOENT')) {
        res.status(404).json({ message: 'Archivo no encontrado' });
      } else {
        res.status(500).json({ message: 'Error al descargar archivo' });
      }
    }
  }

  @Get('preview/:filename')
  async previewFile(@Param('filename') filename: string, @Res() res: Response) {
    try {
      const filePath = join(process.cwd(), 'uploads', filename);
      const fileStream = createReadStream(filePath);
      
      // Detectar tipo MIME básico
      const extension = filename.split('.').pop()?.toLowerCase();
      let contentType = 'application/octet-stream';
      
      switch (extension) {
        case 'pdf':
          contentType = 'application/pdf';
          break;
        case 'jpg':
        case 'jpeg':
          contentType = 'image/jpeg';
          break;
        case 'png':
          contentType = 'image/png';
          break;
        case 'gif':
          contentType = 'image/gif';
          break;
        case 'txt':
          contentType = 'text/plain';
          break;
      }
      
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600'
      });
      
      fileStream.pipe(res);
    } catch (error) {
      // ➡️ CORRECCIÓN: Manejo de error unknown
      if (error instanceof Error && error.message.includes('ENOENT')) {
        res.status(404).json({ message: 'Archivo no encontrado' });
      } else {
        res.status(500).json({ message: 'Error al previsualizar archivo' });
      }
    }
  }
}
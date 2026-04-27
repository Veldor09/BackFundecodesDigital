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
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { FilesService } from './files.service';
import { Response } from 'express';
import { join, basename, resolve } from 'path';
import * as fs from 'fs';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

/**
 * Sanitiza un nombre de archivo solicitado por el cliente.
 * Previene path traversal (../, /etc/passwd, etc.) usando `basename`.
 */
function safeFilename(raw: string): string {
  const clean = basename(raw || '').trim();
  if (!clean || clean === '.' || clean === '..' || clean.includes('\0')) {
    throw new BadRequestException('Nombre de archivo inválido');
  }
  return clean;
}

/**
 * Busca un archivo dentro de `uploadsDir` sólo en las subcarpetas permitidas.
 * Verifica que la ruta resuelta quede siempre DENTRO de `uploadsDir` (defensa
 * en profundidad contra enlaces simbólicos).
 */
function findAllowedPath(uploadsDir: string, filename: string): string | null {
  const allowedDirs = ['', 'projects', 'projects/docs', 'accounting', 'solicitudes', 'billing'];
  const root = resolve(uploadsDir);

  for (const sub of allowedDirs) {
    const candidate = resolve(join(uploadsDir, sub, filename));
    if (!candidate.startsWith(root)) continue; // traversal check
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
}

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  // ================================================================
  // 🟢 SUBIR ARCHIVO (requiere JWT)
  // ================================================================
  @Post('upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.filesService.uploadFile(file);
  }

  // ================================================================
  // 🔴 ELIMINAR ARCHIVO (requiere JWT)
  // ================================================================
  @Delete('delete')
  @UseGuards(JwtAuthGuard)
  async deleteFile(@Body('url') url: string) {
    return this.filesService.deleteFile(url);
  }

  // ================================================================
  // 🔍 INFO ARCHIVO
  // ================================================================
  @Get('info/:filename')
  @UseGuards(JwtAuthGuard)
  async getFileInfo(@Param('filename') filename: string) {
    const safe = safeFilename(filename);
    return this.filesService.getFileInfo(`/uploads/${safe}`);
  }

  // ================================================================
  // 📥 DESCARGAR ARCHIVO
  // ================================================================
  @Get('download/:filename')
  @UseGuards(JwtAuthGuard)
  async downloadFile(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const safe = safeFilename(filename);
    const uploadsDir = join(process.cwd(), 'uploads');
    const existingPath = findAllowedPath(uploadsDir, safe);

    if (!existingPath) {
      throw new NotFoundException('Archivo no encontrado');
    }

    res.set({
      'Content-Disposition': `attachment; filename="${encodeURIComponent(safe)}"`,
      'Content-Type': 'application/octet-stream',
    });
    fs.createReadStream(existingPath).pipe(res);
  }

  // ================================================================
  // 👁️ PREVISUALIZAR ARCHIVO
  // ================================================================
  @Get('preview/:filename')
  @UseGuards(JwtAuthGuard)
  async previewFile(@Param('filename') filename: string, @Res() res: Response) {
    const safe = safeFilename(filename);
    const uploadsDir = join(process.cwd(), 'uploads');
    const existingPath = findAllowedPath(uploadsDir, safe);

    if (!existingPath) {
      throw new NotFoundException('Archivo no encontrado');
    }

    const ext = safe.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      txt: 'text/plain; charset=utf-8',
    };
    const contentType = mimeTypes[ext ?? ''] || 'application/octet-stream';

    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
    });
    fs.createReadStream(existingPath).pipe(res);
  }
}

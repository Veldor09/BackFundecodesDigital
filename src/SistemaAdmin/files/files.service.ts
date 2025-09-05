import { Injectable, BadRequestException } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import * as crypto from 'crypto';

// ➡️ INTERFAZ LOCAL (corrige el error)
interface UploadResponse {
  url: string;
  name: string;
  size: number;
  mimeType: string;
  message: string;
}

@Injectable()
export class FilesService {
  private readonly uploadPath = join(process.cwd(), 'uploads');
  private readonly allowedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'
  ];
  private readonly maxSize = 10 * 1024 * 1024; // 10MB

  constructor() {
    if (!existsSync(this.uploadPath)) {
      mkdirSync(this.uploadPath, { recursive: true });
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('No se proporcionó ningún archivo');
    }

    if (!this.allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`Tipo de archivo no permitido: ${file.mimetype}`);
    }

    if (file.size > this.maxSize) {
      throw new BadRequestException(`El archivo excede el tamaño máximo de 10MB`);
    }

    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExtension}`;
    const filePath = join(this.uploadPath, fileName);

    try {
      const writeStream = createWriteStream(filePath);
      writeStream.write(file.buffer);
      writeStream.end();

      return {
        url: `/uploads/${fileName}`,
        name: file.originalname,
        size: file.size,
        mimeType: file.mimetype,
        message: 'Archivo subido exitosamente'
      };
    } catch (error) {
      // ➡️ CORRECCIÓN: Manejo de error unknown
      if (error instanceof Error) {
        throw new BadRequestException(`Error al guardar el archivo: ${error.message}`);
      } else {
        throw new BadRequestException('Error desconocido al guardar el archivo');
      }
    }
  }

  async deleteFile(fileUrl: string): Promise<{ message: string }> {
    try {
      const fileName = fileUrl.split('/').pop();
      if (!fileName) {
        throw new BadRequestException('URL de archivo inválida');
      }

      const filePath = join(this.uploadPath, fileName);
      
      if (existsSync(filePath)) {
        const fs = await import('fs');
        fs.unlinkSync(filePath);
        return { message: 'Archivo eliminado exitosamente' };
      } else {
        throw new BadRequestException('Archivo no encontrado');
      }
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      // ➡️ CORRECCIÓN: Manejo de error unknown
      if (error instanceof Error) {
        throw new BadRequestException(`Error al eliminar archivo: ${error.message}`);
      } else {
        throw new BadRequestException('Error desconocido al eliminar archivo');
      }
    }
  }

  validateFileType(mimeType: string): boolean {
    return this.allowedTypes.includes(mimeType);
  }

  getFileInfo(fileUrl: string) {
    const fileName = fileUrl.split('/').pop();
    if (!fileName) return null;
    
    const filePath = join(this.uploadPath, fileName);
    if (!existsSync(filePath)) return null;
    
    const fs = require('fs');
    const stats = fs.statSync(filePath);
    
    return {
      name: fileName,
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime
    };
  }
}
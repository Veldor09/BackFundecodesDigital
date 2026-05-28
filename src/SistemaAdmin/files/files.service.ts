// src/SistemaAdmin/files/files.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { StorageService } from '../../common/storage/storage.service';

export interface UploadResponse {
  url: string;
  key: string;
  name: string;
  size: number;
  mimeType: string;
  message: string;
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class FilesService {
  constructor(private readonly storage: StorageService) {}

  /**
   * Sube un archivo a Cloudflare R2.
   * @param file   Archivo de Multer (memory storage)
   * @param folder Carpeta destino dentro del bucket (default: 'uploads')
   */
  async uploadFile(
    file: Express.Multer.File,
    folder = 'uploads',
  ): Promise<UploadResponse> {
    if (!file) throw new BadRequestException('No se proporcionó ningún archivo');

    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        `Tipo de archivo no permitido: ${file.mimetype}`,
      );
    }

    if (file.size > MAX_SIZE) {
      throw new BadRequestException('El archivo excede el tamaño máximo de 10 MB');
    }

    const uploaded = await this.storage.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
      folder,
    );

    return {
      url: uploaded.url,
      key: uploaded.key,
      name: uploaded.name,
      size: uploaded.size,
      mimeType: uploaded.mimeType,
      message: 'Archivo subido exitosamente',
    };
  }

  /**
   * Elimina un archivo por su key (clave dentro del bucket).
   */
  async deleteFileByKey(key: string): Promise<{ message: string }> {
    await this.storage.delete(key);
    return { message: 'Archivo eliminado exitosamente' };
  }

  /**
   * Elimina un archivo a partir de su URL pública.
   * Extrae el key automáticamente desde la URL.
   */
  async deleteFile(fileUrl: string): Promise<{ message: string }> {
    const key = this.storage.keyFromUrl(fileUrl);
    if (key) {
      await this.storage.delete(key);
    }
    return { message: 'Archivo eliminado exitosamente' };
  }

  validateFileType(mimeType: string): boolean {
    return ALLOWED_TYPES.includes(mimeType);
  }
}

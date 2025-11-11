import { Injectable, BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';

/**
 * 📦 Servicio de almacenamiento local de archivos (reportes, respaldos, etc.)
 * Si luego se usa Cloudinary o Drive, se puede reemplazar por otro adaptador.
 */
@Injectable()
export class StorageService {
  private readonly basePath = join(process.cwd(), 'uploads', 'reports');

  constructor() {
    // Crea el directorio base si no existe
    fs.mkdirSync(this.basePath, { recursive: true });
  }

  /**
   * Guarda un archivo desde un buffer y devuelve sus metadatos
   */
  async saveFile(buffer: Buffer, originalName: string) {
    if (!buffer) {
      throw new BadRequestException('El archivo está vacío o no es válido');
    }

    const uniqueName = `${Date.now()}-${randomUUID()}-${originalName}`;
    const fullPath = join(this.basePath, uniqueName);

    await fs.promises.writeFile(fullPath, buffer);

    const stats = await fs.promises.stat(fullPath);

    const mime =
      originalName.endsWith('.pdf')
        ? 'application/pdf'
        : originalName.endsWith('.csv')
        ? 'text/csv'
        : 'application/octet-stream';

    return {
      url: `/uploads/reports/${uniqueName}`,
      bytes: stats.size,
      mime,
      filename: uniqueName,
    };
  }

  /**
   * Elimina un archivo del servidor (si existe)
   */
  async deleteFile(filename: string) {
    const filePath = join(this.basePath, filename);
    try {
      await fs.promises.unlink(filePath);
      return true;
    } catch (err: any) {
      // ✅ Tipado explícito para evitar error TS18046
      if (err?.code === 'ENOENT') return false; // no existe
      throw err;
    }
  }

  /**
   * Verifica si un archivo existe en el almacenamiento local
   */
  async exists(filename: string): Promise<boolean> {
    const filePath = join(this.basePath, filename);
    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
      return true;
    } catch (err: any) {
      if (err?.code === 'ENOENT') return false;
      throw err;
    }
  }

  /**
   * Obtiene la ruta absoluta de un archivo almacenado
   */
  getFilePath(filename: string): string {
    return join(this.basePath, filename);
  }

  /**
   * Lee un archivo y devuelve su contenido en Buffer
   */
  async readFile(filename: string): Promise<Buffer> {
    const filePath = this.getFilePath(filename);
    try {
      return await fs.promises.readFile(filePath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        throw new BadRequestException('El archivo solicitado no existe');
      }
      throw err;
    }
  }
}

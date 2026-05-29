// src/common/storage/storage.service.ts
import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

export interface UploadedFile {
  url: string;         // URL pública permanente
  key: string;         // Clave dentro del bucket (para borrado)
  name: string;        // Nombre original
  size: number;
  mimeType: string;
}

/**
 * StorageService — Cloudflare R2 (compatible con S3 API)
 *
 * Variables de entorno requeridas:
 *   R2_ACCOUNT_ID       — ID de cuenta Cloudflare
 *   R2_ACCESS_KEY_ID    — Access Key ID del token R2
 *   R2_SECRET_ACCESS_KEY — Secret Access Key del token R2
 *   R2_BUCKET           — Nombre del bucket
 *   R2_PUBLIC_URL       — URL pública base (p.ej. https://pub-xxx.r2.dev o dominio custom)
 *
 * Si R2_ACCOUNT_ID está vacío, el servicio cae en modo "local" y devuelve
 * una URL ficticia (útil en desarrollo).
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client | null = null;
  private readonly bucket: string;
  private readonly publicUrl: string;
  private readonly localMode: boolean;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID') ?? '';
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID') ?? '';
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY') ?? '';
    this.bucket = config.get<string>('R2_BUCKET') ?? 'fundecodes';
    this.publicUrl = (config.get<string>('R2_PUBLIC_URL') ?? '').replace(/\/$/, '');
    this.localMode = !accountId || !accessKeyId || !secretAccessKey;

    if (this.localMode) {
      this.logger.warn(
        'StorageService: R2 credentials not configured — running in LOCAL mode. ' +
        'Files will not be uploaded to R2.',
      );
    } else {
      this.client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log(`StorageService: R2 bucket "${this.bucket}" @ ${this.publicUrl}`);
    }
  }

  /**
   * Sube un archivo y devuelve la URL pública permanente.
   *
   * @param file      Buffer del archivo (viene de Multer memory storage)
   * @param mimetype  MIME type del archivo
   * @param original  Nombre original del archivo (para extraer la extensión)
   * @param folder    Carpeta dentro del bucket (p. ej. 'projects', 'receipts')
   */
  async upload(
    file: Buffer,
    mimetype: string,
    original: string,
    folder = 'uploads',
  ): Promise<UploadedFile> {
    const ext = (original.split('.').pop() ?? 'bin').toLowerCase();
    const key = `${folder}/${crypto.randomUUID()}.${ext}`;

    if (this.localMode || !this.client) {
      // Modo local: guarda el archivo en ./uploads/<key> y lo sirve vía el
      // servidor estático que main.ts ya monta en /uploads/.
      const port = this.config.get<string>('PORT') ?? '4000';
      const appUrl = (this.config.get<string>('APP_URL') ?? '').replace(/\/+$/, '');
      const base = appUrl || `http://localhost:${port}`;
      const destPath = path.join(process.cwd(), 'uploads', key);
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.writeFileSync(destPath, file);
      const localUrl = `${base}/uploads/${key}`;
      this.logger.debug(`[LOCAL] Saved to disk: ${destPath}`);
      return {
        url: localUrl,
        key,
        name: original,
        size: file.length,
        mimeType: mimetype,
      };
    }

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file,
          ContentType: mimetype,
          // Acceso público — asegúrate de que el bucket sea público o use dominio custom
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );

      const url = `${this.publicUrl}/${key}`;
      this.logger.debug(`Uploaded: ${key} → ${url}`);
      return { url, key, name: original, size: file.length, mimeType: mimetype };
    } catch (err: any) {
      this.logger.error(`R2 upload failed: ${err?.message}`, err?.stack);
      throw new BadRequestException(`Error al subir el archivo: ${err?.message ?? 'desconocido'}`);
    }
  }

  /**
   * Elimina un archivo del bucket por su key.
   * Es seguro llamarlo aunque el archivo no exista.
   */
  async delete(key: string): Promise<void> {
    if (this.localMode || !this.client || !key) return;

    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      this.logger.debug(`Deleted: ${key}`);
    } catch (err: any) {
      // No lanzamos — un fallo al borrar no debe detener el flujo principal
      this.logger.warn(`R2 delete failed for key "${key}": ${err?.message}`);
    }
  }

  /**
   * Genera una URL pre-firmada (acceso temporal a archivos privados).
   * Si el bucket es público, no es necesario usar esto.
   */
  async presign(key: string, expiresInSeconds = 3600): Promise<string> {
    if (this.localMode || !this.client) {
      const port = this.config.get<string>('PORT') ?? '4000';
      const appUrl = (this.config.get<string>('APP_URL') ?? '').replace(/\/+$/, '');
      const base = appUrl || `http://localhost:${port}`;
      return `${base}/uploads/${key}`;
    }

    const cmd = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return getSignedUrl(this.client, cmd, { expiresIn: expiresInSeconds });
  }

  /**
   * Extrae el key de una URL pública generada por este servicio.
   * Útil para borrar un archivo conociendo solo su URL.
   */
  keyFromUrl(url: string): string | null {
    if (!url || !this.publicUrl) return null;
    const prefix = `${this.publicUrl}/`;
    return url.startsWith(prefix) ? url.slice(prefix.length) : null;
  }
}

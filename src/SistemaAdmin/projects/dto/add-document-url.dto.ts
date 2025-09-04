// src/SistemaAdmin/projects/dto/add-document-url.dto.ts
import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

/**
 * Body JSON:
 * {
 *   "url": "https://.../file.pdf",
 *   "name": "Brochure del proyecto",
 *   "mimeType": "application/pdf"
 * }
 */
export class AddDocumentUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'url es requerido' })
  @IsUrl({}, { message: 'url debe ser un URL válido' })
  @Transform(({ value }) => trim(value))
  url!: string;

  @IsString()
  @IsNotEmpty({ message: 'name es requerido' })
  @Transform(({ value }) => trim(value))
  name!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  mimeType?: string;
}

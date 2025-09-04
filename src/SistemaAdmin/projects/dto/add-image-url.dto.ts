// src/SistemaAdmin/projects/dto/add-image-url.dto.ts
import { IsInt, IsNotEmpty, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

/**
 * Body JSON esperado:
 * {
 *   "url": "https://.../image.jpg",
 *   "alt": "Texto alternativo",
 *   "order": 0
 * }
 */
export class AddImageUrlDto {
  @IsString()
  @IsNotEmpty({ message: 'url es requerido' })
  @IsUrl({}, { message: 'url debe ser un URL válido' })
  @Transform(({ value }) => trim(value))
  url!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  alt?: string;

  @IsOptional()
  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? 0 : Number(value),
  )
  @IsInt({ message: 'order debe ser entero' })
  @Min(0, { message: 'order no puede ser negativo' })
  order?: number;
}

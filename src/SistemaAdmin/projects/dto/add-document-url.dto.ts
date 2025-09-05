// src/SistemaAdmin/projects/dto/add-document-url.dto.ts

import { IsNotEmpty, IsOptional, IsString, IsUrl, IsNumber } from 'class-validator';
import { Transform, Type } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

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

  @IsOptional()
  @IsNumber({}, { message: 'size debe ser un número' })
  @Type(() => Number)
  size?: number;
}
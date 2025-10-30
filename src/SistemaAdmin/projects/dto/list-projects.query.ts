import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ProjectStatus } from '@prisma/client';

function emptyToUndef(v: unknown) {
  return typeof v === 'string' && v.trim() === '' ? undefined : v;
}
function toBoolOrUndef(v: unknown) {
  if (v === '' || v === undefined || v === null) return undefined;
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  if (v === false || v === 'false' || v === '0' || v === 0) return false;
  return undefined;
}

export class ListProjectsQuery {
  // 🔎 búsqueda libre (front manda `q`)
  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndef(value))
  q?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndef(value))
  place?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndef(value))
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => emptyToUndef(value))
  area?: string;

  // Estado (EN_PROCESO | FINALIZADO | PAUSADO)
  @IsOptional()
  @IsEnum(ProjectStatus)
  @Transform(({ value }) => emptyToUndef(value))
  status?: ProjectStatus;

  // Paginación
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number;

  // Publicado (front manda "", "true" o "false")
  @IsOptional()
  @Transform(({ value }) => toBoolOrUndef(value))
  @IsBoolean()
  published?: boolean;

  // Compat opcional que ya usabas en el controlador
  @IsOptional()
  @Transform(({ value }) => toBoolOrUndef(value))
  @IsBoolean()
  includeVols?: boolean;
}

// src/SistemaAdmin/cuentas/dto/list-cuentas.query.ts
import { Type, Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

const toBoolOrUndef = (v: unknown) => {
  if (v === '' || v === undefined || v === null) return undefined;
  if (v === true || v === 'true' || v === '1' || v === 1) return true;
  if (v === false || v === 'false' || v === '0' || v === 0) return false;
  return undefined;
};

export class ListCuentasQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  /** Búsqueda por nombre o código (contains, case-insensitive). */
  @IsOptional()
  @IsString()
  q?: string;

  /** Filtrar solo activas / solo archivadas. Por defecto devuelve ambas. */
  @IsOptional()
  @Transform(({ value }) => toBoolOrUndef(value))
  @IsBoolean()
  activa?: boolean;
}

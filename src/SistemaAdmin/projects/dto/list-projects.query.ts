import { IsOptional, IsInt, Min, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class ListProjectsQuery {
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

  // <— Permite ?includeVols=1 / true / 0 / false
  @IsOptional()
  @IsIn(['1', '0', 'true', 'false'])
  includeVols?: string;

  // (opcionales, por si los usas en el futuro)
  @IsOptional()
  @IsString()
  estado?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @IsString()
  search?: string;
}

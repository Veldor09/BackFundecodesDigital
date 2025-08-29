import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export const STATUS_VALUES = ['EN_PROCESO', 'FINALIZADO', 'PAUSADO'] as const;
type Status = typeof STATUS_VALUES[number];

export class ListProjectsQuery {
  @IsOptional()
  @IsString()
  q?: string; // busca en title/summary/content

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(STATUS_VALUES as readonly string[], {
    message: `status debe ser uno de: ${STATUS_VALUES.join(', ')}`,
  })
  status?: Status;

  @IsOptional()
  @IsString()
  place?: string;

  @IsOptional()
  @IsString()
  area?: string;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value, 10))
  @IsInt()
  @Min(1)
  pageSize: number = 10;

  @IsOptional()
  @Transform(({ value }) => value === 'true')
  published?: boolean;
}

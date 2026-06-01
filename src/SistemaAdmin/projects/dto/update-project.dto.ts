// src/SistemaAdmin/projects/dto/update-project.dto.ts
import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
  MaxLength,
  Min,
} from 'class-validator';
import { Currency } from '@prisma/client';
import { Transform } from 'class-transformer';
import { ProjectStatusEnum, ProjectStatus } from './project-status.enum';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'title no puede estar vacío' })
  @MaxLength(150, { message: 'title no puede exceder 150 caracteres' })
  title?: string;

  // si viene, se normaliza; si no viene pero cambian title/place, se regenera
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @MaxLength(150, { message: 'summary no puede exceder 150 caracteres' })
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  coverUrl?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'category no puede estar vacío' })
  category?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'place no puede estar vacío' })
  place?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'area no puede estar vacío' })
  area?: string;

  @IsOptional()
  @IsEnum(ProjectStatusEnum, {
    message: `status debe ser uno de: ${Object.values(ProjectStatusEnum).join(', ')}`,
  })
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoTotal?: number;

  @IsOptional()
  @IsEnum(Currency)
  monedaPresupuesto?: Currency;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'publishedAt debe ser una fecha válida (ISO 8601)' },
  )
  publishedAt?: string;
}

// src/SistemaAdmin/projects/dto/create-project.dto.ts
import {
  IsBoolean,
  IsDefined,
  IsOptional,
  IsString,
  IsNotEmpty,
  IsEnum,
  IsDateString,
} from 'class-validator';
import { Transform } from 'class-transformer';

// Enum local alineado con prisma/schema.prisma
export const ProjectStatusEnum = {
  EN_PROCESO: 'EN_PROCESO',
  FINALIZADO: 'FINALIZADO',
  PAUSADO: 'PAUSADO',
} as const;
export type ProjectStatus =
  (typeof ProjectStatusEnum)[keyof typeof ProjectStatusEnum];

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

export class CreateProjectDto {
  @IsDefined({ message: 'title es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'title no puede estar vacío' })
  title!: string;

  // opcional: si no viene, se genera desde title + place
  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  slug?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  summary?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  coverUrl?: string;

  // NOT NULL
  @IsDefined({ message: 'category es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'category no puede estar vacío' })
  category!: string;

  @IsDefined({ message: 'place es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'place no puede estar vacío' })
  place!: string;

  @IsDefined({ message: 'area es requerido' })
  @IsString()
  @Transform(({ value }) => trim(value))
  @IsNotEmpty({ message: 'area no puede estar vacío' })
  area!: string;

  @IsOptional()
  @IsEnum(ProjectStatusEnum, {
    message: `status debe ser uno de: ${Object.values(ProjectStatusEnum).join(', ')}`,
  })
  status?: ProjectStatus;

  @IsOptional()
  @IsBoolean()
  published?: boolean;

  @IsOptional()
  @IsDateString(
    {},
    { message: 'publishedAt debe ser una fecha válida (ISO 8601)' },
  )
  publishedAt?: string;
}

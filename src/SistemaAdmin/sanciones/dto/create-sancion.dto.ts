import { IsInt, IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';

export enum SancionTipo {
  LEVE = 'LEVE',
  GRAVE = 'GRAVE',
  MUY_GRAVE = 'MUY_GRAVE',
  EXTREMADAMENTE_GRAVE = 'EXTREMADAMENTE_GRAVE',
}

export class CreateSancionDto {
  @IsInt()
  voluntarioId: number;

  @IsEnum(SancionTipo)
  tipo: SancionTipo;

  @IsString()
  motivo: string;

  @IsOptional()
  @IsString()
  descripcion?: string;

  @IsISO8601()
  fechaInicio: string;

  @IsOptional()
  @IsISO8601()
  fechaVencimiento?: string | null;

  @IsOptional()
  @IsString()
  creadaPor?: string;
}

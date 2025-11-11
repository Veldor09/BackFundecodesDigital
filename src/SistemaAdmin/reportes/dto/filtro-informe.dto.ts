import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString } from 'class-validator';

export enum TipoPeriodo {
  ANIO = 'ANIO',
  RANGO = 'RANGO',
}

export class FiltroInformeDto {
  @ApiProperty({
    description: 'Lista separada por comas o arreglo con los módulos a incluir.',
    example: ['projects', 'billing', 'solicitudes', 'collaborators', 'volunteers'],
  })
  @IsOptional()
  @IsString({ each: true })
  modulos: string | string[];

  @ApiProperty({
    description:
      'Tipo de agrupación: Mensual, Trimestral, Cuatrimestral, Semestral o Anual',
    example: 'Anual',
  })
  @IsString()
  tipoReporte: string;

  @ApiProperty({
    description: 'Tipo de periodo del informe (ANIO o RANGO)',
    enum: TipoPeriodo,
  })
  @IsEnum(TipoPeriodo)
  periodo: TipoPeriodo;

  @ApiPropertyOptional({ example: 2025 })
  @IsOptional()
  @IsString()
  anio?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2025-12-31' })
  @IsOptional()
  @IsString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: 'pdf' })
  @IsOptional()
  @IsString()
  formato?: string;
}

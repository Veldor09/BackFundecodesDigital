import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsDateString } from 'class-validator';

export enum TipoPeriodo {
  ANIO = 'ANIO',
  RANGO = 'RANGO',
}

export class FiltroInformeDto {
  @ApiProperty({
    description: 'Periodo del informe (ANIO o RANGO)',
    enum: TipoPeriodo,
    example: 'RANGO',
  })
  periodo: TipoPeriodo;

  @ApiPropertyOptional({
    description: 'Año a consultar (solo si periodo=ANIO)',
    example: '2025',
  })
  @IsOptional()
  @IsString()
  anio?: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio (solo si periodo=RANGO)',
    example: '2024-01-01',
  })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin (solo si periodo=RANGO)',
    example: '2025-12-31',
  })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiProperty({
    description: 'Tipo de agrupación: Mensual, Trimestral, Cuatrimestral, Semestral, Anual',
    example: 'Mensual',
  })
  tipoReporte: string;

  @ApiProperty({
    description: 'Lista separada por comas con los módulos a incluir en el informe',
    example: 'projects,billing,solicitudes,collaborators,volunteers',
  })
  modulos: string;

  @ApiProperty({
    description: 'Formato del informe (pdf o excel)',
    example: 'pdf',
  })
  @IsOptional()
  formato?: string;
}

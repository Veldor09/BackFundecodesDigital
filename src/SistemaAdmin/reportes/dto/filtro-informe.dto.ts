import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  ValidateIf,
  ArrayNotEmpty,
} from 'class-validator';

export enum TipoPeriodo {
  ANIO = 'año',
  RANGO = 'rango',
}

export enum TipoReporte {
  MENSUAL = 'Mensual',
  TRIMESTRAL = 'Trimestral',
  CUATRIMESTRAL = 'Cuatrimestral',
  SEMESTRAL = 'Semestral',
  ANUAL = 'Anual',
}

export class FiltroInformeDto {
  @IsEnum(TipoPeriodo)
  periodo!: TipoPeriodo;

  @ValidateIf((o) => o.periodo === TipoPeriodo.ANIO)
  @Type(() => Number)
  @IsInt()
  anio?: number;

  @ValidateIf((o) => o.periodo === TipoPeriodo.RANGO)
  @IsString()
  fechaInicio?: string;

  @ValidateIf((o) => o.periodo === TipoPeriodo.RANGO)
  @IsString()
  fechaFin?: string;

  @IsEnum(TipoReporte)
  tipoReporte!: TipoReporte;

  /**
   * Permite recibir tanto un array como una cadena separada por comas.
   * Ejemplo válido: "projects,billing,solicitudes"
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value.split(',').map((v) => v.trim());
    }
    return value;
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  modulos!: string[];
}

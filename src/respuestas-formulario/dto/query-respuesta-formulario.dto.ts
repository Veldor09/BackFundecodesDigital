import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export enum EstadoRespuestaFormularioDto {
  PENDIENTE = 'PENDIENTE',
  ACEPTADO = 'ACEPTADO',
  RECHAZADO = 'RECHAZADO',
}

export class QueryRespuestaFormularioDto {
  @IsOptional()
  @IsString({ message: 'El search debe ser texto' })
  search?: string;

  @IsOptional()
  @IsString({ message: 'El tipoFormulario debe ser texto' })
  tipoFormulario?: string;

  @IsOptional()
  @IsEnum(EstadoRespuestaFormularioDto, {
    message: 'El estado no es válido',
  })
  estado?: EstadoRespuestaFormularioDto;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'La página debe ser un número entero' })
  @Min(1, { message: 'La página mínima es 1' })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero' })
  @Min(1, { message: 'El límite mínimo es 1' })
  @Max(100, { message: 'El límite máximo es 100' })
  limit?: number = 10;
}




import { IsEnum } from 'class-validator';

export enum EstadoRespuestaFormularioDto {
  PENDIENTE = 'PENDIENTE',
  ACEPTADO = 'ACEPTADO',
  RECHAZADO = 'RECHAZADO',
}

export class UpdateEstadoRespuestaDto {
  @IsEnum(EstadoRespuestaFormularioDto, {
    message: 'El estado no es válido',
  })
  estado: EstadoRespuestaFormularioDto;
}
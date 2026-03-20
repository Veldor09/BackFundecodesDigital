import { IsEnum } from 'class-validator';

export enum EstadoRespuestaFormularioUpdateDto {
  PENDIENTE = 'PENDIENTE',
  REVISADO = 'REVISADO',
  RESPONDIDO = 'RESPONDIDO',
}

export class UpdateEstadoRespuestaDto {
  @IsEnum(EstadoRespuestaFormularioUpdateDto, {
    message: 'El estado no es válido',
  })
  estado: EstadoRespuestaFormularioUpdateDto;
}
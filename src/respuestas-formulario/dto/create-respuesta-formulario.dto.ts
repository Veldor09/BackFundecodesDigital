import {
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MaxLength,
} from 'class-validator';

export enum TipoFormularioDto {
  CONTACTO = 'CONTACTO',
  VOLUNTARIADO = 'VOLUNTARIADO',
  ALIANZA = 'ALIANZA',
  COMENTARIO = 'COMENTARIO',
}

export class CreateRespuestaFormularioDto {
  @IsEnum(TipoFormularioDto, {
    message: 'El tipoFormulario no es válido',
  })
  tipoFormulario: TipoFormularioDto;

  @IsOptional()
  @IsString({ message: 'El nombre debe ser texto' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  nombre?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  correo?: string;

  @IsOptional()
  @IsString({ message: 'El teléfono debe ser texto' })
  @MaxLength(30, { message: 'El teléfono no puede superar 30 caracteres' })
  telefono?: string;

  @IsObject({ message: 'El payload debe ser un objeto válido' })
  payload: Record<string, any>;
}
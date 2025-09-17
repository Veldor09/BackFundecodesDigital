import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

// Formato cédula CR: 1-1111-1111 o 01-1234-5678
const CEDULA_REGEX = /^[0-9]{1,2}-[0-9]{3,4}-[0-9]{3,4}$/;

export class UpdateCollaboratorDto {
  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre completo del colaborador',
  })
  @IsOptional()
  @IsString()
  @Length(3, 150, {
    message: 'El nombre completo debe tener entre 3 y 150 caracteres',
  })
  nombreCompleto?: string;

  @ApiPropertyOptional({
    example: 'juan.perez@fundecodes.org',
    description: 'Correo electrónico único',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @Length(5, 160, { message: 'El correo debe tener entre 5 y 160 caracteres' })
  correo?: string;

  @ApiPropertyOptional({
    example: '1-5678-1234',
    description: 'Cédula del colaborador',
  })
  @IsOptional()
  @IsString()
  @Length(5, 25, { message: 'La cédula debe tener entre 5 y 25 caracteres' })
  @Matches(CEDULA_REGEX, { message: 'La cédula no cumple el formato esperado' })
  cedula?: string;

  @ApiPropertyOptional({
    example: '1995-12-15',
    description: 'Fecha de nacimiento en formato ISO (YYYY-MM-DD)',
  })
  @IsOptional()
  @IsString({
    message: 'La fecha de nacimiento debe ser una cadena en formato ISO',
  })
  fechaNacimiento?: string | null;

  @ApiPropertyOptional({
    example: '88889999',
    description: 'Número de teléfono',
  })
  @IsOptional()
  @IsString()
  @Length(5, 25, { message: 'El teléfono debe tener entre 5 y 25 caracteres' })
  telefono?: string | null;

  @ApiPropertyOptional({
    enum: CollaboratorRol,
    example: CollaboratorRol.COLABORADOR,
    description: 'Rol del colaborador (ADMIN o COLABORADOR)',
  })
  @IsOptional()
  @IsEnum(CollaboratorRol, { message: 'El rol debe ser ADMIN o COLABORADOR' })
  rol?: CollaboratorRol;

  @ApiPropertyOptional({
    example: 'NuevoPass123!',
    description:
      'Contraseña en texto plano (se volverá a hashear si se actualiza)',
  })
  @IsOptional()
  @IsString()
  @Length(8, 100, {
    message: 'La contraseña debe tener entre 8 y 100 caracteres',
  })
  password?: string;

  @ApiPropertyOptional({
    enum: CollaboratorEstado,
    example: CollaboratorEstado.INACTIVO,
    description: 'Estado del colaborador (ACTIVO o INACTIVO)',
  })
  @IsOptional()
  @IsEnum(CollaboratorEstado, {
    message: 'El estado debe ser ACTIVO o INACTIVO',
  })
  estado?: CollaboratorEstado;
}

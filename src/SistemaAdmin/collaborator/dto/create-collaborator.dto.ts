import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

// Formato de cédula CR: 1-1111-1111 o 01-1234-5678
const CEDULA_REGEX = /^[0-9]{1,2}-[0-9]{3,4}-[0-9]{3,4}$/;

export class CreateCollaboratorDto {
  @ApiProperty({
    example: 'Administrador General',
    description: 'Nombre completo del colaborador',
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @Length(3, 150, {
    message: 'El nombre completo debe tener entre 3 y 150 caracteres',
  })
  nombreCompleto!: string;

  @ApiProperty({
    example: 'admin@fundecodes.org',
    description: 'Correo electrónico único',
  })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @Length(5, 160, { message: 'El correo debe tener entre 5 y 160 caracteres' })
  correo!: string;

  @ApiProperty({
    example: '1-1234-5678',
    description: 'Cédula única del colaborador',
  })
  @IsString()
  @Length(5, 25, { message: 'La cédula debe tener entre 5 y 25 caracteres' })
  @Matches(CEDULA_REGEX, { message: 'La cédula no cumple el formato esperado' })
  cedula!: string;

  @ApiProperty({
    example: '1990-05-20',
    description: 'Fecha de nacimiento en formato ISO (YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsString({
    message: 'La fecha de nacimiento debe ser una cadena en formato ISO',
  })
  fechaNacimiento?: string | null;

  @ApiProperty({
    example: '88888888',
    description: 'Teléfono del colaborador',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Length(5, 25, { message: 'El teléfono debe tener entre 5 y 25 caracteres' })
  telefono?: string | null;

  @ApiProperty({
    enum: CollaboratorRol,
    example: CollaboratorRol.ADMIN,
    description: 'Rol del colaborador (ADMIN o COLABORADOR)',
    required: false,
  })
  @IsOptional()
  @IsEnum(CollaboratorRol, { message: 'El rol debe ser ADMIN o COLABORADOR' })
  rol?: CollaboratorRol;

  @ApiProperty({
    example: 'Admin12345!',
    description: 'Contraseña en texto plano (se almacenará hasheada)',
  })
  @IsString()
  @Length(8, 100, {
    message: 'La contraseña debe tener entre 8 y 100 caracteres',
  })
  password!: string;

  @ApiProperty({
    enum: CollaboratorEstado,
    example: CollaboratorEstado.ACTIVO,
    description: 'Estado del colaborador (ACTIVO o INACTIVO)',
    required: false,
  })
  @IsOptional()
  @IsEnum(CollaboratorEstado, {
    message: 'El estado debe ser ACTIVO o INACTIVO',
  })
  estado?: CollaboratorEstado;
}

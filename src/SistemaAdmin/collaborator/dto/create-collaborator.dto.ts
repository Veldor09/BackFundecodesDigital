import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

/**
 * Formatos aceptados de cédula:
 *  - CR típico: 1-1234-5678 o 01-1234-5678
 *  - General: alfanumérico y guiones, 5–25 chars (para DIMEX/pasaporte/etc.)
 */
const CEDULA_REGEX =
  /^(?:\d{1,2}-\d{3,4}-\d{3,4}|[A-Za-z0-9-]{5,25})$/;

/** Teléfono en formato E.164 (+ y de 6 a 20 dígitos) */
const PHONE_E164_REGEX = /^\+\d{6,20}$/;

export class CreateCollaboratorDto {
  @ApiProperty({
    example: 'Administrador General',
    description: 'Nombre completo del colaborador',
    minLength: 3,
    maxLength: 150,
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
    maxLength: 160,
  })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160, { message: 'El correo no puede exceder 160 caracteres' })
  correo!: string;

  @ApiProperty({
    example: '1-1234-5678',
    description:
      'Cédula única. Acepta formato CR (1-1234-5678 u 01-1234-5678) o genérico alfanumérico con guiones (5–25 chars).',
  })
  @IsString()
  @Matches(CEDULA_REGEX, { message: 'La cédula no cumple el formato esperado' })
  @Length(5, 25, { message: 'La cédula debe tener entre 5 y 25 caracteres' })
  cedula!: string;

  @ApiProperty({
    example: '1990-05-20',
    description: 'Fecha de nacimiento (ISO YYYY-MM-DD)',
    required: false,
  })
  @IsOptional()
  @IsString({
    message: 'La fecha de nacimiento debe ser una cadena en formato ISO',
  })
  fechaNacimiento?: string | null;

  @ApiProperty({
    example: '+50688888888',
    description: 'Teléfono en formato E.164 (+ y 6–20 dígitos)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_E164_REGEX, {
    message: 'El teléfono debe estar en formato + y 6–20 dígitos (E.164)',
  })
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
    example: 'Str0ngP@ssw0rd',
    description: 'Contraseña en texto plano (se almacenará hasheada)',
    minLength: 8,
    maxLength: 100,
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

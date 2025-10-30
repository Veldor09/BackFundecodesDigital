import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

// Igual que en Create
const CEDULA_REGEX =
  /^(?:\d{1,2}-\d{3,4}-\d{3,4}|[A-Za-z0-9-]{5,25})$/;
const PHONE_E164_REGEX = /^\+\d{6,20}$/;

// Helper de trim genérico
const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateCollaboratorDto {
  @ApiPropertyOptional({
    example: 'Juan Pérez',
    description: 'Nombre completo del colaborador',
    minLength: 3,
    maxLength: 150,
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 150, {
    message: 'El nombre completo debe tener entre 3 y 150 caracteres',
  })
  nombreCompleto?: string;

  @ApiPropertyOptional({
    example: 'juan.perez@fundecodes.org',
    description: 'Correo electrónico único',
    maxLength: 160,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @MaxLength(160, { message: 'El correo no puede exceder 160 caracteres' })
  correo?: string;

  @ApiPropertyOptional({
    example: '01-1234-5678',
    description:
      'Cédula (CR típico o genérico alfanumérico con guiones, 5–25 chars)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(CEDULA_REGEX, { message: 'La cédula no cumple el formato esperado' })
  @Length(5, 25, { message: 'La cédula debe tener entre 5 y 25 caracteres' })
  cedula?: string;

  @ApiPropertyOptional({
    example: '1995-12-15',
    description: 'Fecha de nacimiento (ISO YYYY-MM-DD)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString({
    message: 'La fecha de nacimiento debe ser una cadena en formato ISO',
  })
  fechaNacimiento?: string | null;

  @ApiPropertyOptional({
    example: '+50688889999',
    description: 'Número de teléfono en formato E.164 (+ y 6–20 dígitos)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Matches(PHONE_E164_REGEX, {
    message: 'El teléfono debe estar en formato + y 6–20 dígitos (E.164)',
  })
  telefono?: string | null;

  @ApiPropertyOptional({
    enum: CollaboratorRol,
    example: CollaboratorRol.COLABORADORPROYECTO,
    description:
      'Rol del colaborador. Valores: admin | colaboradorfactura | colaboradorvoluntariado | colaboradorproyecto | colaboradorcontabilidad',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(CollaboratorRol, {
    message:
      'El rol debe ser uno de: admin, colaboradorfactura, colaboradorvoluntariado, colaboradorproyecto, colaboradorcontabilidad',
  })
  rol?: CollaboratorRol;

  @ApiPropertyOptional({
    example: 'NuevoPass123!',
    description:
      'Contraseña en texto plano (se volverá a hashear si se actualiza)',
    minLength: 8,
    maxLength: 100,
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
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(CollaboratorEstado, {
    message: 'El estado debe ser ACTIVO o INACTIVO',
  })
  estado?: CollaboratorEstado;
}

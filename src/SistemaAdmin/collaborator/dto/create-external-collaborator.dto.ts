import {
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CollaboratorRol } from './collaborator-rol.enum';

/** Teléfono en formato E.164 (+ y de 6 a 20 dígitos) */
const PHONE_E164_REGEX = /^\+\d{6,20}$/;

// Helper de trim
const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * DTO para crear un colaborador externo de área.
 * Solo requiere nombre, correo, teléfono y área asignada.
 * Roles permitidos: colaboradorsolicitante | colaboradorvoluntariadoexterno
 */
export class CreateExternalCollaboratorDto {
  @ApiProperty({
    example: 'María López',
    description: 'Nombre completo del colaborador externo',
    minLength: 3,
    maxLength: 150,
  })
  @IsString()
  @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
  @Transform(trim)
  @Length(3, 150, {
    message: 'El nombre completo debe tener entre 3 y 150 caracteres',
  })
  nombreCompleto!: string;

  @ApiProperty({
    example: 'maria.lopez@organizacion.org',
    description: 'Correo electrónico único',
    maxLength: 160,
  })
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(160, { message: 'El correo no puede exceder 160 caracteres' })
  correo!: string;

  @ApiPropertyOptional({
    example: '+50688888888',
    description: 'Teléfono en formato E.164 (+ y 6–20 dígitos)',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Matches(PHONE_E164_REGEX, {
    message: 'El teléfono debe estar en formato + y 6–20 dígitos (E.164)',
  })
  telefono?: string | null;

  @ApiProperty({
    enum: [CollaboratorRol.COLABORADORSOLICITANTE, CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO],
    example: CollaboratorRol.COLABORADORSOLICITANTE,
    description: 'Rol del colaborador externo: colaboradorsolicitante | colaboradorvoluntariadoexterno',
  })
  @IsEnum(
    [CollaboratorRol.COLABORADORSOLICITANTE, CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO],
    {
      message:
        'El rol debe ser "colaboradorsolicitante" o "colaboradorvoluntariadoexterno"',
    },
  )
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  rol!: CollaboratorRol.COLABORADORSOLICITANTE | CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO;

  @ApiProperty({
    example: 1,
    description: 'ID del área a la que pertenece el colaborador externo',
  })
  @IsInt({ message: 'areaId debe ser un número entero' })
  @Min(1, { message: 'areaId debe ser mayor que 0' })
  @Transform(({ value }) => Number(value))
  areaId!: number;
}

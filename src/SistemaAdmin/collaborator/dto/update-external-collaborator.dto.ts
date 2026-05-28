import {
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

const PHONE_E164_REGEX = /^\+\d{6,20}$/;
const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateExternalCollaboratorDto {
  @ApiPropertyOptional({
    example: 'María López',
    description: 'Nombre completo',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @Length(3, 150, {
    message: 'El nombre completo debe tener entre 3 y 150 caracteres',
  })
  nombreCompleto?: string;

  @ApiPropertyOptional({
    example: 'maria.lopez@organizacion.org',
    description: 'Correo electrónico único',
  })
  @IsOptional()
  @IsEmail({}, { message: 'El correo no tiene un formato válido' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @MaxLength(160, { message: 'El correo no puede exceder 160 caracteres' })
  correo?: string;

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

  @ApiPropertyOptional({
    enum: [CollaboratorRol.COLABORADORSOLICITANTE, CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO],
    example: CollaboratorRol.COLABORADORSOLICITANTE,
    description: 'Rol externo: colaboradorsolicitante | colaboradorvoluntariadoexterno',
  })
  @IsOptional()
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
  rol?: CollaboratorRol.COLABORADORSOLICITANTE | CollaboratorRol.COLABORADORVOLUNTARIADOEXTERNO;

  @ApiPropertyOptional({
    example: 1,
    description: 'ID del área asignada (null para desvincular)',
  })
  @IsOptional()
  @IsInt({ message: 'areaId debe ser un número entero' })
  @Min(1, { message: 'areaId debe ser mayor que 0' })
  @Transform(({ value }) => (value !== null && value !== '' ? Number(value) : null))
  areaId?: number | null;

  @ApiPropertyOptional({
    enum: CollaboratorEstado,
    example: CollaboratorEstado.ACTIVO,
    description: 'Estado del colaborador (ACTIVO o INACTIVO)',
  })
  @IsOptional()
  @IsEnum(CollaboratorEstado, {
    message: 'El estado debe ser ACTIVO o INACTIVO',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  estado?: CollaboratorEstado;
}

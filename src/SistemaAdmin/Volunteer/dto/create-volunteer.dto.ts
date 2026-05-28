import {
  IsEmail,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateVolunteerDto {
  @ApiProperty({ example: 'María García López', description: 'Nombre completo del voluntario' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre es obligatorio' })
  @Transform(trim)
  @MaxLength(200)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Costa Rica', description: 'Nacionalidad del voluntario' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(100)
  nacionalidad?: string;

  @ApiProperty({
    example: '2026-01-15',
    description: 'Fecha de inicio del voluntariado (ISO YYYY-MM-DD)',
  })
  @IsNotEmpty({ message: 'La fecha de entrada es obligatoria' })
  @IsISO8601({}, { message: 'fechaEntrada debe ser una fecha ISO válida (YYYY-MM-DD)' })
  fechaEntrada!: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description:
      'Fecha de salida del voluntariado (ISO YYYY-MM-DD). ' +
      'El sistema elimina el voluntario automáticamente al día siguiente.',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'fechaSalida debe ser una fecha ISO válida (YYYY-MM-DD)' })
  fechaSalida?: string;

  @ApiPropertyOptional({
    example: 'Cruz Roja Internacional',
    description: 'ONG u organización de origen del voluntario',
  })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  ong?: string;

  @ApiPropertyOptional({ example: 'voluntario@ong.org', description: 'Correo electrónico de contacto' })
  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(160)
  email?: string;
}

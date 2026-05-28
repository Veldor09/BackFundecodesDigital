import {
  IsEmail,
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: any }) =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateVolunteerDto {
  @ApiPropertyOptional({ example: 'María García López' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Costa Rica' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(100)
  nacionalidad?: string;

  @ApiPropertyOptional({ example: '2026-01-15' })
  @IsOptional()
  @IsISO8601({}, { message: 'fechaEntrada debe ser una fecha ISO válida' })
  fechaEntrada?: string;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description: 'Fecha de salida. Al día siguiente el cron elimina al voluntario.',
  })
  @IsOptional()
  @IsISO8601({}, { message: 'fechaSalida debe ser una fecha ISO válida' })
  fechaSalida?: string | null;

  @ApiPropertyOptional({ example: 'Cruz Roja Internacional' })
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MaxLength(200)
  ong?: string;

  @ApiPropertyOptional({ example: 'voluntario@ong.org' })
  @IsOptional()
  @IsEmail({}, { message: 'El email no es válido' })
  @MaxLength(160)
  email?: string;
}

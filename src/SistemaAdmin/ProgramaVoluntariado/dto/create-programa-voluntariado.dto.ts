import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUrl, MaxLength, Min } from 'class-validator';
import { Currency } from '@prisma/client';

export class CreateProgramaVoluntariadoDto {
  @ApiProperty({ example: 'Programa Reforestación 2026' })
  @IsString()
  @MaxLength(150)
  nombre: string;

  @ApiPropertyOptional({ example: 'Programa de apoyo comunitario...' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descripcion?: string;

  @ApiProperty({ example: 'Nicoya, Guanacaste' })
  @IsString()
  @MaxLength(160)
  lugar: string;

  @ApiPropertyOptional({
    example: 30,
    description: '0 significa sin límite de participantes',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  limiteParticipantes?: number;

  @ApiPropertyOptional({ example: 500000, description: 'Presupuesto asignado (0 = sin presupuesto definido)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  presupuestoTotal?: number;

  @ApiPropertyOptional({ example: 'CRC', enum: Currency })
  @IsOptional()
  @IsEnum(Currency)
  monedaPresupuesto?: Currency;

  @ApiPropertyOptional({ example: 'https://r2.example.com/programs/img.jpg' })
  @IsOptional()
  @IsUrl({}, { message: 'imagenUrl no es una URL válida' })
  imagenUrl?: string;

  @ApiPropertyOptional({ description: 'Clave R2 para borrado posterior' })
  @IsOptional()
  @IsString()
  imagenKey?: string;
}
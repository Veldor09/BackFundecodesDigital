import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateProgramaVoluntariadoDto {
  @ApiProperty({ example: 'Programa Reforestación 2026' })
  @IsString()
  @MaxLength(160)
  nombre: string;

  @ApiPropertyOptional({ example: 'Programa de apoyo comunitario...' })
  @IsOptional()
  @IsString()
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
}
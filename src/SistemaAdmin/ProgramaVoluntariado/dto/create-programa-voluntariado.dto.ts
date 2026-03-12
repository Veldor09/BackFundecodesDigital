import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateProgramaVoluntariadoDto {
  @ApiProperty({ example: 'Programa Reforestación 2026' })
  @IsString()
  @MaxLength(160)
  nombre: string;

  @ApiProperty({ example: 'Programa de apoyo comunitario...', required: false })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiProperty({ example: 'Nicoya, Guanacaste' })
  @IsString()
  @MaxLength(160)
  lugar: string;
}
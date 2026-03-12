import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateAsignacionVoluntarioDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  pagoRealizado?: boolean;

  @ApiPropertyOptional({ enum: ['CUENTA_PROPIA', 'INTERMEDIARIO'] })
  @IsOptional()
  @IsIn(['CUENTA_PROPIA', 'INTERMEDIARIO'])
  origen?: 'CUENTA_PROPIA' | 'INTERMEDIARIO';

  @ApiPropertyOptional({ example: 'Empresa XYZ' })
  @IsOptional()
  @IsString()
  intermediario?: string;

  @ApiPropertyOptional({ example: '2026-03-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaEntrada?: string;

  @ApiPropertyOptional({ example: '2026-03-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaSalida?: string;

  @ApiPropertyOptional({ example: 40 })
  @IsOptional()
  @IsInt()
  @Min(0)
  horasTotales?: number;
}
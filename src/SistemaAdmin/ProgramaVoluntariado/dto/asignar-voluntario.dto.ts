import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AsignarVoluntarioDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  pagoRealizado: boolean;

  @ApiProperty({
    example: 'CUENTA_PROPIA',
    enum: ['CUENTA_PROPIA', 'INTERMEDIARIO'],
  })
  @IsIn(['CUENTA_PROPIA', 'INTERMEDIARIO'])
  origen: 'CUENTA_PROPIA' | 'INTERMEDIARIO';

  @ApiPropertyOptional({ example: 'Empresa XYZ (si aplica)' })
  @IsOptional()
  @IsString()
  intermediario?: string;

  @ApiProperty({ example: '2026-03-01T00:00:00.000Z' })
  @IsDateString()
  fechaEntrada: string;

  @ApiPropertyOptional({ example: '2026-03-30T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  fechaSalida?: string;

  @ApiProperty({ example: 40 })
  @IsInt()
  @Min(0)
  horasTotales: number;
}
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsString,
  IsNumber,
  IsPositive,
  IsDateString,
  IsInt,
  IsOptional,
  ValidateIf,
} from 'class-validator';

export class CreateTransaccionDto {
  @ApiProperty({ enum: ['ingreso', 'egreso'] })
  @IsEnum(['ingreso', 'egreso'])
  tipo: 'ingreso' | 'egreso';

  @ApiProperty({ enum: ['CRC', 'USD', 'EUR'] })
  @IsEnum(['CRC', 'USD', 'EUR'])
  moneda: 'CRC' | 'USD' | 'EUR';

  @ApiProperty()
  @IsString()
  categoria: string;

  @ApiProperty()
  @IsString()
  descripcion: string;

  @ApiProperty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  @ApiProperty({ example: '2025-10-06' })
  @IsDateString()
  fecha: string;

  // Exactamente uno de los dos debe estar presente — el service valida XOR.
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  projectId?: number;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  programaId?: number;

  // Nombre legible del destino (se almacena como snapshot).
  @ApiProperty({ example: 'Sistema de Gestión Educativa' })
  @IsString()
  proyecto: string;
}

export class AnularTransaccionDto {
  @ApiProperty({ description: 'Motivo de la anulación' })
  @IsString()
  motivo: string;
}

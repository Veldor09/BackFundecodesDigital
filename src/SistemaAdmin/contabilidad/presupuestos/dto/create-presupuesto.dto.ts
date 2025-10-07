import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsString, IsOptional, IsNumber } from 'class-validator';

export class CreatePresupuestoDto {
  @ApiProperty({ example: 1 }) @IsInt()
  projectId: number;

  @ApiProperty({ example: 'Sistema de Gestión Educativa' }) @IsString()
  proyecto: string;

  @ApiProperty({ example: 1, description: 'Mes 1..12' }) @IsInt() @Min(1) @Max(12)
  mes: number;

  @ApiProperty({ example: 2025 }) @IsInt() @Min(2000) @Max(2100)
  anio: number;

  @ApiProperty({ example: 100000 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoAsignado: number;

  @ApiProperty({ example: 75000 }) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoEjecutado: number;
}

export class UpdatePresupuestoDto {
  @IsOptional() @IsInt() @Min(1) @Max(12)
  mes?: number;

  @IsOptional() @IsInt() @Min(2000) @Max(2100)
  anio?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoAsignado?: number;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0)
  montoEjecutado?: number;

  @IsOptional() @IsString()
  proyecto?: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, IsNumber, IsPositive, IsDateString, IsInt, IsOptional } from 'class-validator';

export class CreateTransaccionDto {
  @ApiProperty({ enum: ['ingreso', 'egreso'] })
  @IsEnum(['ingreso', 'egreso'] as any)
  tipo: 'ingreso' | 'egreso';

  @ApiProperty() @IsString()
  categoria: string;

  @ApiProperty() @IsString()
  descripcion: string;

  @ApiProperty() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  monto: number;

  @ApiProperty({ example: '2025-10-06' }) @IsDateString()
  fecha: string;

  @ApiProperty({ example: 1 }) @IsInt()
  projectId: number;

  @ApiProperty({ example: 'Sistema de Gestión Educativa' }) @IsString()
  proyecto: string;
}

export class UpdateTransaccionDto {
  @IsOptional() @IsEnum(['ingreso', 'egreso'] as any)
  tipo?: 'ingreso' | 'egreso';

  @IsOptional() @IsString()
  categoria?: string;

  @IsOptional() @IsString()
  descripcion?: string;

  @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @IsPositive()
  monto?: number;

  @IsOptional() @IsDateString()
  fecha?: string;

  @IsOptional() @IsInt()
  projectId?: number;

  @IsOptional() @IsString()
  proyecto?: string;
}

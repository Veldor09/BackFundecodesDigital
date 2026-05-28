// src/SistemaAdmin/cuentas/dto/create-cuenta.dto.ts
//
// DTO para crear una Cuenta contable. Las cuentas funcionan como contenedor
// financiero de proyectos y programas (un proyecto/programa puede o no estar
// dentro de una cuenta, pero si lo está, sus transacciones se imputan a la
// cuenta hasta que se mueva a otra).
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { Currency } from '@prisma/client';
import { Transform } from 'class-transformer';

const trim = (v: unknown) => (typeof v === 'string' ? v.trim() : v);

export class CreateCuentaDto {
  @IsString()
  @Transform(({ value }) => trim(value))
  @MinLength(2, { message: 'El nombre debe tener al menos 2 caracteres' })
  @MaxLength(120, { message: 'El nombre no puede superar 120 caracteres' })
  nombre!: string;

  /** Código / consecutivo bancario / identificador externo. Único en el sistema. */
  @IsString()
  @Transform(({ value }) => trim(value))
  @MinLength(1, { message: 'El código es obligatorio' })
  @MaxLength(60, { message: 'El código no puede superar 60 caracteres' })
  codigo!: string;

  @IsOptional()
  @IsString()
  @Transform(({ value }) => trim(value))
  @MaxLength(500, { message: 'La descripción no puede superar 500 caracteres' })
  descripcion?: string;

  /** Moneda base. Las transacciones individuales pueden tener otra moneda. */
  @IsOptional()
  @IsEnum(Currency, { message: 'Moneda inválida (CRC, USD o EUR)' })
  monedaBase?: Currency;

  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  /** Área organizacional a la que pertenece esta cuenta. */
  @IsOptional()
  @Transform(({ value }) => (value !== null && value !== '' ? Number(value) : null))
  @IsInt({ message: 'areaId debe ser un número entero' })
  @Min(1, { message: 'areaId debe ser mayor que 0' })
  areaId?: number | null;
}

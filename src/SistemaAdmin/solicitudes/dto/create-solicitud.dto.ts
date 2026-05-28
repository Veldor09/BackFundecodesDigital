// src/SistemaAdmin/solicitudes/dto/create-solicitud.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
} from 'class-validator';

export enum TipoOrigenSolicitudDto {
  PROGRAMA = 'PROGRAMA',
  PROYECTO = 'PROYECTO',
}

export class CreateSolicitudDto {
  @ApiProperty({ example: 'Compra de materiales' })
  @IsString()
  titulo: string;

  @ApiProperty({ example: 'Necesito papelería para la oficina del programa.' })
  @IsString()
  descripcion: string;

  /**
   * Monto solicitado. Obligatorio para nuevas solicitudes.
   * Decimal en BD; aquí lo recibimos como número (puede venir como string
   * desde multipart/form-data — `Type(() => Number)` lo coacciona).
   */
  @ApiProperty({ example: 250000, description: 'Monto solicitado, mayor a 0.' })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  monto: number;

  /**
   * Nuevo flujo: ID del Área a la que pertenece la solicitud.
   * El sistema resuelve automáticamente la cuenta asociada al área.
   */
  @ApiPropertyOptional({ description: 'ID del Área (nuevo flujo basado en área)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  areaId?: number;

  /**
   * Tipo de destino legacy (PROGRAMA o PROYECTO). Conservado para compatibilidad.
   */
  @ApiPropertyOptional({ enum: TipoOrigenSolicitudDto, example: TipoOrigenSolicitudDto.PROGRAMA })
  @IsOptional()
  @IsEnum(TipoOrigenSolicitudDto)
  tipoOrigen?: TipoOrigenSolicitudDto;

  @ApiPropertyOptional({ description: 'ID del programa de voluntariado (legacy)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programaId?: number;

  @ApiPropertyOptional({ description: 'ID del proyecto (legacy)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  projectId?: number;

  @ApiPropertyOptional({
    description: 'ID del usuario que crea la solicitud. Si no se envía se usa el autenticado.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  usuarioId?: number;
}

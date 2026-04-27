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
   * Tipo de destino: PROGRAMA o PROYECTO. Obligatorio.
   * Junto con uno (y solo uno) de programaId/projectId.
   */
  @ApiProperty({ enum: TipoOrigenSolicitudDto, example: TipoOrigenSolicitudDto.PROGRAMA })
  @IsEnum(TipoOrigenSolicitudDto)
  tipoOrigen: TipoOrigenSolicitudDto;

  @ApiPropertyOptional({ description: 'ID del programa de voluntariado (si tipoOrigen=PROGRAMA)' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  programaId?: number;

  @ApiPropertyOptional({ description: 'ID del proyecto (si tipoOrigen=PROYECTO)' })
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

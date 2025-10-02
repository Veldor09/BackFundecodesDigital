// src/SistemaAdmin/solicitudes/dto/create-solicitud.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsNumber } from 'class-validator';

export class CreateSolicitudDto {
  @ApiProperty()
  @IsString()
  titulo: string;

  @ApiProperty()
  @IsString()
  descripcion: string;

  @ApiProperty({ required: false, type: Number, description: 'ID del usuario que crea la solicitud (si no se envía se usará el usuario autenticado)' })
  @IsOptional()
  @IsNumber()
  usuarioId?: number;
}
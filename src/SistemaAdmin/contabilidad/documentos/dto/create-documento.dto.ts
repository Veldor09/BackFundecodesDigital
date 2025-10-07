import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min, Max, IsString } from 'class-validator';

export class CreateDocumentoDto {
  @ApiProperty({ example: 1 }) @IsInt()
  projectId: number;

  @ApiProperty({ example: 'Sistema de Gestión Educativa' }) @IsString()
  proyecto: string;

  @ApiProperty({ example: 1, minimum: 1, maximum: 12 }) @IsInt() @Min(1) @Max(12)
  mes: number;

  @ApiProperty({ example: 2025 }) @IsInt() @Min(2000) @Max(2100)
  anio: number;
}

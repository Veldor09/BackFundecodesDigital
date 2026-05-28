import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = (v: any) => (typeof v === 'string' ? v.trim() : v);

export class CreateAreaDto {
  @ApiProperty({ example: 'Camaronal' })
  @IsString()
  @IsNotEmpty({ message: 'El nombre del área es requerido' })
  @MaxLength(120)
  @Transform(({ value }) => trim(value))
  nombre: string;

  @ApiPropertyOptional({ example: 'Área de operaciones en Camaronal, Guanacaste' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Transform(({ value }) => trim(value))
  descripcion?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

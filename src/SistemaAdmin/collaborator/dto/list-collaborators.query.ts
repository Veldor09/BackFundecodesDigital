import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

export class ListCollaboratorsQuery {
  @ApiPropertyOptional({
    description: 'Búsqueda general (nombre, correo, cédula, teléfono)',
    example: 'admin',
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString({ message: 'q debe ser una cadena' })
  q?: string;

  @ApiPropertyOptional({
    enum: CollaboratorRol,
    description:
      'Filtrar por rol. Valores: admin | colaboradorfactura | colaboradorvoluntariado | colaboradorproyecto | colaboradorcontabilidad',
    example: CollaboratorRol.ADMIN,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsEnum(CollaboratorRol, {
    message:
      'rol debe ser uno de: admin, colaboradorfactura, colaboradorvoluntariado, colaboradorproyecto, colaboradorcontabilidad',
  })
  rol?: CollaboratorRol;

  @ApiPropertyOptional({
    enum: CollaboratorEstado,
    description: 'Filtrar por estado',
    example: CollaboratorEstado.ACTIVO,
  })
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsEnum(CollaboratorEstado, { message: 'estado debe ser ACTIVO o INACTIVO' })
  estado?: CollaboratorEstado;

  @ApiPropertyOptional({
    description: 'Página (1..n)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page debe ser un entero' })
  @Min(1, { message: 'page mínimo es 1' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Tamaño de página (1..100)',
    example: 10,
    default: 10,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'pageSize debe ser un entero' })
  @Min(1, { message: 'pageSize mínimo es 1' })
  @Max(100, { message: 'pageSize máximo es 100' })
  pageSize?: number = 10;
}

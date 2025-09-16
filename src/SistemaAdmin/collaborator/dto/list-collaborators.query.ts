import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

export class ListCollaboratorsQuery {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsEnum(CollaboratorRol)
  rol?: CollaboratorRol;

  @IsOptional()
  @IsEnum(CollaboratorEstado)
  estado?: CollaboratorEstado;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}

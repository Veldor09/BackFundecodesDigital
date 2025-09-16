import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

export class UpdateCollaboratorDto {
  @IsOptional()
  @IsString()
  @Length(3, 150)
  nombreCompleto?: string;

  @IsOptional()
  @IsEmail()
  @Length(5, 160)
  correo?: string;

  @IsOptional()
  @IsString()
  @Length(5, 25)
  cedula?: string;

  /** ISO date (YYYY-MM-DD) */
  @IsOptional()
  @IsString()
  fechaNacimiento?: string | null;

  @IsOptional()
  @IsString()
  @Length(5, 25)
  telefono?: string | null;

  @IsOptional()
  @IsEnum(CollaboratorRol)
  rol?: CollaboratorRol;

  /** Plain password; si viene, se vuelve a hashear */
  @IsOptional()
  @IsString()
  @Length(8, 100)
  password?: string;

  @IsOptional()
  @IsEnum(CollaboratorEstado)
  estado?: CollaboratorEstado;
}

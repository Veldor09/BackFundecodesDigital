import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
} from 'class-validator';
import { CollaboratorRol } from './collaborator-rol.enum';
import { CollaboratorEstado } from './collaborator-estado.enum';

export class CreateCollaboratorDto {
  @IsString()
  @IsNotEmpty()
  @Length(3, 150)
  nombreCompleto!: string;

  @IsEmail()
  @Length(5, 160)
  correo!: string;

  @IsString()
  @Length(5, 25)
  cedula!: string;

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

  /** Plain password; se hashea en el service */
  @IsString()
  @Length(8, 100)
  password!: string;

  @IsOptional()
  @IsEnum(CollaboratorEstado)
  estado?: CollaboratorEstado;
}

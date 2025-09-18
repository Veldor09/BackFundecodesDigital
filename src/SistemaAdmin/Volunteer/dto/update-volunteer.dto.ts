import { IsEmail, IsOptional, IsISO8601, IsIn } from 'class-validator';

export class UpdateVolunteerDto {
  @IsOptional()
  tipoDocumento?: string;

  @IsOptional()
  numeroDocumento?: string;

  @IsOptional()
  nombreCompleto?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  telefono?: string;

  @IsOptional()
  @IsISO8601()
  fechaNacimiento?: string;

  @IsOptional()
  @IsISO8601()
  fechaIngreso?: string;

  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}

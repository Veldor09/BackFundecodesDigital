import { IsEmail, IsNotEmpty, IsOptional, IsISO8601, IsIn } from 'class-validator';

export class CreateVolunteerDto {
  @IsNotEmpty()
  tipoDocumento: string;

  @IsNotEmpty()
  numeroDocumento: string;

  @IsNotEmpty()
  nombreCompleto: string;

  @IsEmail()
  email: string;

  @IsOptional()
  telefono?: string;

  @IsOptional()
  @IsISO8601()
  fechaNacimiento?: string; // ISO (yyyy-mm-dd o completa)

  // NUEVO: permitir fechaIngreso opcional (si no se manda, Prisma pone now())
  @IsOptional()
  @IsISO8601()
  fechaIngreso?: string; // ISO

  // NUEVO: permitir estado opcional (si no se manda, Prisma pone ACTIVO)
  @IsOptional()
  @IsIn(['ACTIVO', 'INACTIVO'])
  estado?: 'ACTIVO' | 'INACTIVO';
}

import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CreateVolunteerDto {
  @IsNotEmpty()
  @IsString()
  nombre: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  telefono: string;

  @IsNotEmpty()
  @IsString()
  disponibilidad: string;

  @IsNotEmpty()
  @IsString()
  mensaje: string;
}
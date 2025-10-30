// src/SistemaAdmin/users/dto/create-user.dto.ts
import { IsEmail, IsOptional, IsString, IsBoolean, IsArray, IsIn, MinLength } from 'class-validator';

export const ROLE_VALUES = [
  'admin',
  'voluntario',
  'colaboradorfacturas',
  'colaboradorvoluntariado',
  'colaboradorproyecto',
  'colaboradorcontabilidad',
  'colaboradorvoluntario',
] as const;

export type RoleName = typeof ROLE_VALUES[number];

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsArray()
  @IsIn(ROLE_VALUES, { each: true })
  roles?: RoleName[];
}

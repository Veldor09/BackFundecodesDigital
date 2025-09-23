// src/auth/dto/set-password.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ description: 'Token JWT recibido por email (30 min de vigencia)' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña', minLength: 8 })
  @IsString()
  @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' })
  newPassword: string;

  @ApiPropertyOptional({ description: 'Confirmación de la nueva contraseña (opcional si tu UI no la envía)', minLength: 8 })
  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'La confirmación debe tener al menos 8 caracteres' })
  confirmPassword?: string;
}

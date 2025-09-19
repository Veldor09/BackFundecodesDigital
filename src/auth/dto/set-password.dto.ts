import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({ description: 'Token JWT recibido por email (30 min de vigencia)' })
  @IsString()
  token: string;

  @ApiProperty({ description: 'Nueva contraseña', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;

  @ApiProperty({ description: 'Confirmación de la nueva contraseña', minLength: 8 })
  @IsString()
  @MinLength(8)
  confirmPassword: string;
}

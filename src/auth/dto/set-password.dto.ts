// src/auth/dto/set-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class SetPasswordDto {
  @ApiProperty({
    description: 'Token JWT enviado por correo (vigencia 30 minutos)',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  token!: string;

  @ApiProperty({
    description: 'Nueva contraseña definitiva',
    minLength: 8,
    example: 'Nuev4Cl@ve2024!',
  })
  @IsString()
  @Length(8, 100)
  newPassword!: string;
}

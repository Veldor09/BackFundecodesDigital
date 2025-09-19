import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'usuario@fundecodes.org' })
  @IsEmail()
  email!: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@fundecodes.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'fundecodes2025' })
  @IsString()
  @MinLength(6)
  password: string;
}

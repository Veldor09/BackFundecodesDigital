import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength, IsBoolean, IsArray, ArrayNotEmpty, ArrayUnique } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nuevo@fundecodes.org' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Juan Pérez', required: false })
  @IsOptional() @IsString()
  name?: string;

  @ApiProperty({ example: 'ClaveTemporal123' })
  @IsString() @MinLength(6)
  password: string;

  @ApiProperty({ example: false, required: false })
  @IsOptional() @IsBoolean()
  verified?: boolean;

  @ApiProperty({ example: ['USER'], required: false, description: 'ADMIN/USER' })
  @IsOptional() @IsArray() @ArrayUnique()
  roles?: string[];
}

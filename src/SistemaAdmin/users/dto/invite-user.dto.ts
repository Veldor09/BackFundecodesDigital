import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsEmail, IsOptional, IsString } from 'class-validator';

export class InviteUserDto {
  @ApiProperty({ example: 'rodriguezderek12@gmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Derek Rodriguez', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ example: ['COLABORADOR'], required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  roles?: string[];
}

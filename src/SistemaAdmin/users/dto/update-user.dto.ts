// src/SistemaAdmin/users/dto/update-user.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto, RoleName, ROLE_VALUES } from './create-user.dto';
import { IsOptional, IsArray, IsIn } from 'class-validator';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsArray()
  @IsIn(ROLE_VALUES, { each: true })
  roles?: RoleName[];
}

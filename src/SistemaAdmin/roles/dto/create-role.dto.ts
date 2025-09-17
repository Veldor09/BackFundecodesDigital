import { IsArray, IsOptional, IsString, ArrayUnique } from 'class-validator';

export class CreateRoleDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /**
   * Lista de keys de permisos a asignar al rol.
   * Ejemplos: ["users.manage", "projects.manage"]
   */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  permissionKeys?: string[];
}

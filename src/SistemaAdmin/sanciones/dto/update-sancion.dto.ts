import { PartialType } from '@nestjs/mapped-types';
import { CreateSancionDto } from './create-sancion.dto';
import { IsInt } from 'class-validator';

export class UpdateSancionDto extends PartialType(CreateSancionDto) {
  @IsInt()
  id: number;
}

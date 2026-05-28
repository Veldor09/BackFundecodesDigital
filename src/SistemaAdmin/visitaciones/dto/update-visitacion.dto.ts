import { PartialType } from '@nestjs/mapped-types';
import { CreateVisitacionDto } from './create-visitacion.dto';

export class UpdateVisitacionDto extends PartialType(CreateVisitacionDto) {}

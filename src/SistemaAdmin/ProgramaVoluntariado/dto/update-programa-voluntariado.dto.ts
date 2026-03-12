import { PartialType } from '@nestjs/swagger';
import { CreateProgramaVoluntariadoDto } from './create-programa-voluntariado.dto';

export class UpdateProgramaVoluntariadoDto extends PartialType(CreateProgramaVoluntariadoDto) {}
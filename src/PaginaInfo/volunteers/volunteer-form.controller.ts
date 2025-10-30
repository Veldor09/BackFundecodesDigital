// src/PaginaInfo/volunteers/volunteer-form.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { VolunteersFormService } from './volunteer-form.service';
import { CreateVolunteerFormDto } from './dto/create-volunteer-form.dto';
import { Public } from '../../common/decorators/public.decorator'; // ✅ import agregado

@Controller('volunteers-form')
export class VolunteersFormController {
  constructor(private readonly volunteersFormService: VolunteersFormService) {}

  // ✅ Ruta pública (no requiere token JWT)
  @Public()
  @Post()
  create(@Body() createVolunteerFormDto: CreateVolunteerFormDto) {
    return this.volunteersFormService.create(createVolunteerFormDto);
  }
}

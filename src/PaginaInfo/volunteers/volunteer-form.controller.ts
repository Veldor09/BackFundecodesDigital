import { Body, Controller, Post } from '@nestjs/common';
import { VolunteersFormService } from './volunteer-form.service';
import { CreateVolunteerFormDto } from './dto/create-volunteer-form.dto';

@Controller('volunteers-form')
export class VolunteersFormController {
  constructor(private readonly volunteersFormService: VolunteersFormService) {}

  @Post()
  create(@Body() createVolunteerFormDto: CreateVolunteerFormDto) {
    return this.volunteersFormService.create(createVolunteerFormDto);
  }
}

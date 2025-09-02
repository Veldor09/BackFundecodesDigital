import { Body, Controller, Post } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Controller('volunteers')
export class VolunteersController {
  constructor(private readonly volunteersService: VolunteersService) {}

  @Post()
  create(@Body() createVolunteerDto: CreateVolunteerDto) {
    return this.volunteersService.create(createVolunteerDto);
  }
}
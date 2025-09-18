import { Controller, Get, Post, Put, Patch, Param, Body, Query } from '@nestjs/common';
import { VolunteerService } from './volunteer.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

@Controller('voluntarios')
export class VolunteerController {
  constructor(private readonly volunteerService: VolunteerService) {}

  @Post()
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteerService.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('estado') estado?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    const skip = (Number(page) - 1) * Number(limit);
    const take = Number(limit);
    const orderBy = { [sortBy]: order };
    const where = estado ? { estado } : {};
    return this.volunteerService.findAll({ skip, take, orderBy, where });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.volunteerService.findOne(Number(id));
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateVolunteerDto) {
    return this.volunteerService.update(Number(id), dto);
  }

  // Ruta original (se mantiene)
  @Patch(':id/toggle-status')
  toggleStatusLegacy(@Param('id') id: string, @Body('estado') estado: 'ACTIVO' | 'INACTIVO') {
    return this.volunteerService.toggleStatus(Number(id), estado);
  }

  // NUEVA ruta corta para compatibilidad con el front
  @Patch(':id/toggle')
  toggleStatus(@Param('id') id: string, @Body('estado') estado: 'ACTIVO' | 'INACTIVO') {
    return this.volunteerService.toggleStatus(Number(id), estado);
  }
}

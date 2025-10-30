import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

import { VolunteerService } from './volunteer.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('voluntario:access')
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
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerService.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteerService.update(id, dto);
  }

  // Ruta original (se mantiene)
  @Patch(':id/toggle-status')
  toggleStatusLegacy(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'ACTIVO' | 'INACTIVO',
  ) {
    return this.volunteerService.toggleStatus(id, estado);
  }

  // Ruta corta para compatibilidad con el front
  @Patch(':id/toggle')
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'ACTIVO' | 'INACTIVO',
  ) {
    return this.volunteerService.toggleStatus(id, estado);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerService.remove(id);
  }
}

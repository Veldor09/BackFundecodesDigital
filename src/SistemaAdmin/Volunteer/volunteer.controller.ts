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
import { Audit } from '../auditoria/audit.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('voluntario:access')
@Controller('voluntarios')
export class VolunteerController {
  constructor(private readonly volunteerService: VolunteerService) {}

  @Post()
  @Audit({
    accion: 'VOLUNTARIO_CREAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ result }) =>
      `Registró voluntario "${(result as any)?.nombreCompleto ?? ''}" (${(result as any)?.email ?? ''}).`,
  })
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
  @Audit({
    accion: 'VOLUNTARIO_EDITAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ params }) => `Editó voluntario #${params.id}.`,
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteerService.update(id, dto);
  }

  // Ruta original (se mantiene)
  @Patch(':id/toggle-status')
  @Audit({
    accion: 'VOLUNTARIO_TOGGLE_ESTADO',
    entidad: 'Voluntario',
    resolveDetalle: ({ params, body }) =>
      `Cambió estado de voluntario #${params.id} a ${body?.estado ?? '?'}.`,
  })
  toggleStatusLegacy(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'ACTIVO' | 'INACTIVO',
  ) {
    return this.volunteerService.toggleStatus(id, estado);
  }

  // Ruta corta para compatibilidad con el front
  @Patch(':id/toggle')
  @Audit({
    accion: 'VOLUNTARIO_TOGGLE_ESTADO',
    entidad: 'Voluntario',
    resolveDetalle: ({ params, body }) =>
      `Cambió estado de voluntario #${params.id} a ${body?.estado ?? '?'}.`,
  })
  toggleStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('estado') estado: 'ACTIVO' | 'INACTIVO',
  ) {
    return this.volunteerService.toggleStatus(id, estado);
  }

  @Delete(':id')
  @Audit({
    accion: 'VOLUNTARIO_ELIMINAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ params }) => `Eliminó voluntario #${params.id}.`,
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerService.remove(id);
  }
}

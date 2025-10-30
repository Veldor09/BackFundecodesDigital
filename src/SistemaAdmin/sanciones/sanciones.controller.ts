import {
  Controller,
  Get,
  Post,
  Body,
  Put,
  Param,
  Delete,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { SancionesService } from './sanciones.service';
import { CreateSancionDto } from './dto/create-sancion.dto';
import { UpdateSancionDto } from './dto/update-sancion.dto';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard'; // ⬅️ ajusta ruta si es necesario
import { PermissionsGuard } from '../../common/guards/permissions.guard'; // ⬅️ ajusta ruta
import { Permissions } from '../../common/decorators/permissions.decorator'; // ⬅️ ajusta ruta

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('sanciones:access')
@Controller('sanciones')
export class SancionesController {
  constructor(private readonly service: SancionesService) {}

  @Post()
  create(@Body() dto: CreateSancionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('estado') estado?: string,
    @Query('voluntarioId') voluntarioId?: string,
  ) {
    return this.service.findAll({
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      search,
      estado,
      voluntarioId: voluntarioId ? Number(voluntarioId) : undefined,
    });
  }

  // ⚠️ RUTA ESPECÍFICA ANTES DE ':id' PARA EVITAR COLISIÓN
  @Get('voluntario/:voluntarioId/activas')
  activasPorVol(@Param('voluntarioId', ParseIntPipe) voluntarioId: number) {
    return this.service.activasPorVoluntario(voluntarioId);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSancionDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  @Put(':id/revocar')
  revocar(@Param('id', ParseIntPipe) id: number, @Body('revocadaPor') revocadaPor?: string) {
    return this.service.revocar(id, revocadaPor);
  }
}

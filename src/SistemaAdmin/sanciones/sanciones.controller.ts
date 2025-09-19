import { Controller, Get, Post, Body, Put, Param, Delete, Query } from '@nestjs/common';
import { SancionesService } from './sanciones.service';
import { CreateSancionDto } from './dto/create-sancion.dto';
import { UpdateSancionDto } from './dto/update-sancion.dto';

@Controller('api/sanciones')
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

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSancionDto) {
    return this.service.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(+id);
  }

  @Put(':id/revocar')
  revocar(@Param('id') id: string, @Body('revocadaPor') revocadaPor?: string) {
    return this.service.revocar(+id, revocadaPor);
  }

  @Get('voluntario/:voluntarioId/activas')
  activasPorVol(@Param('voluntarioId') voluntarioId: string) {
    return this.service.activasPorVoluntario(+voluntarioId);
  }
}

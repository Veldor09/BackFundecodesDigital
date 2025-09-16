import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { ListCollaboratorsQuery } from './dto/list-collaborators.query';


import { CollaboratorRol } from './dto/collaborator-rol.enum';
import { CollaboratorEstado } from './dto/collaborator-estado.enum';

@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly service: CollaboratorsService) {}

  @Post()
  create(@Body() dto: CreateCollaboratorDto) {
    return this.service.create({
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      cedula: dto.cedula,
      fechaNacimiento: dto.fechaNacimiento ?? null,
      telefono: dto.telefono ?? null,
      rol: (dto.rol as CollaboratorRol) ?? undefined,
      password: dto.password,
      estado: (dto.estado as CollaboratorEstado) ?? undefined,
    });
  }

  @Get()
  list(@Query() q: ListCollaboratorsQuery) {
    return this.service.list({
      q: q.q,
      rol: q.rol as CollaboratorRol | undefined,
      estado: q.estado as CollaboratorEstado | undefined,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 10,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCollaboratorDto) {
    return this.service.update(id, {
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      cedula: dto.cedula,
      fechaNacimiento: dto.fechaNacimiento,
      telefono: dto.telefono,
      rol: dto.rol as CollaboratorRol | undefined,
      password: dto.password,
      estado: dto.estado as CollaboratorEstado | undefined,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

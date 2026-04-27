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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

import { ProgramaVoluntariadoService } from './programa-voluntariado.service';
import { CreateProgramaVoluntariadoDto } from './dto/create-programa-voluntariado.dto';
import { UpdateProgramaVoluntariadoDto } from './dto/update-programa-voluntariado.dto';
import { ListProgramaVoluntariadoQuery } from './dto/list-programa-voluntariado.query';
import { AsignarVoluntarioDto } from './dto/asignar-voluntario.dto';

// ✅ NUEVO DTO (parcial) para updates como "pagoRealizado"
import { UpdateAsignacionVoluntarioDto } from './dto/update-asignacion-voluntario.dto';

// Auditoría
import { Audit } from '../auditoria/audit.decorator';

@ApiTags('programa-voluntariado')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('programa-voluntariado:access')
@Controller('programa-voluntariado')
export class ProgramaVoluntariadoController {
  constructor(private readonly service: ProgramaVoluntariadoService) {}

  // ===================== PROGRAMAS =====================

  @Get()
  list(@Query() query: ListProgramaVoluntariadoQuery) {
    return this.service.list(query);
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  @Audit({
    accion: 'PROGRAMA_CREAR',
    entidad: 'ProgramaVoluntariado',
    resolveDetalle: ({ result }) =>
      `Creó programa "${(result as any)?.nombre ?? ''}".`,
  })
  create(@Body() dto: CreateProgramaVoluntariadoDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Audit({
    accion: 'PROGRAMA_EDITAR',
    entidad: 'ProgramaVoluntariado',
    resolveDetalle: ({ params }) => `Editó programa #${params.id}.`,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProgramaVoluntariadoDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Audit({
    accion: 'PROGRAMA_ELIMINAR',
    entidad: 'ProgramaVoluntariado',
    resolveDetalle: ({ params }) => `Eliminó programa #${params.id}.`,
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // ===================== ASIGNACIONES =====================

  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'voluntarioId', type: Number })
  @Post(':id/voluntarios/:voluntarioId')
  @Audit({
    accion: 'PROGRAMA_ASIGNAR_VOLUNTARIO',
    entidad: 'ProgramaVoluntariado',
    resolveEntidadId: ({ params }) => params.id,
    resolveDetalle: ({ params }) =>
      `Asignó voluntario #${params.voluntarioId} al programa #${params.id}.`,
  })
  assignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Param('voluntarioId', ParseIntPipe) voluntarioId: number,
    @Body() dto: AsignarVoluntarioDto,
  ) {
    return this.service.assignVolunteer(id, voluntarioId, dto);
  }

  // ✅ IMPORTANTE: acá NO usamos AsignarVoluntarioDto (ese es para crear)
  // ✅ usamos UpdateAsignacionVoluntarioDto (parcial), para permitir { pagoRealizado: true }
  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'voluntarioId', type: Number })
  @Patch(':id/voluntarios/:voluntarioId')
  @Audit({
    accion: 'PROGRAMA_ACTUALIZAR_ASIGNACION',
    entidad: 'ProgramaVoluntariado',
    resolveEntidadId: ({ params }) => params.id,
    resolveDetalle: ({ params, body }) =>
      `Actualizó asignación voluntario #${params.voluntarioId} en programa #${params.id} ${
        body?.pagoRealizado !== undefined
          ? `(pagoRealizado=${body.pagoRealizado})`
          : ''
      }.`,
  })
  updateAssignment(
    @Param('id', ParseIntPipe) id: number,
    @Param('voluntarioId', ParseIntPipe) voluntarioId: number,
    @Body() dto: UpdateAsignacionVoluntarioDto,
  ) {
    return this.service.updateAssignment(id, voluntarioId, dto);
  }

  @ApiParam({ name: 'id', type: Number })
  @ApiParam({ name: 'voluntarioId', type: Number })
  @Delete(':id/voluntarios/:voluntarioId')
  @Audit({
    accion: 'PROGRAMA_DESASIGNAR_VOLUNTARIO',
    entidad: 'ProgramaVoluntariado',
    resolveEntidadId: ({ params }) => params.id,
    resolveDetalle: ({ params }) =>
      `Desasignó voluntario #${params.voluntarioId} del programa #${params.id}.`,
  })
  unassignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Param('voluntarioId', ParseIntPipe) voluntarioId: number,
  ) {
    return this.service.unassignVolunteer(id, voluntarioId);
  }
}
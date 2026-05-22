// src/SistemaAdmin/cuentas/cuentas.controller.ts
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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

import { CuentasService } from './cuentas.service';
import { CreateCuentaDto } from './dto/create-cuenta.dto';
import { UpdateCuentaDto } from './dto/update-cuenta.dto';
import { ListCuentasQuery } from './dto/list-cuentas.query';

@ApiTags('Cuentas')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('cuentas:access')
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}

  // ─────────────── CRUD ───────────────
  @Post()
  @ApiOperation({ summary: 'Crear una nueva cuenta contable' })
  create(@Body() dto: CreateCuentaDto) {
    return this.cuentas.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar cuentas con filtros y paginación' })
  @ApiOkResponse({ description: 'Listado paginado' })
  findAll(@Query() query: ListCuentasQuery) {
    return this.cuentas.findAll(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Detalle de cuenta + proyectos y programas asignados',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar una cuenta (parcial)' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCuentaDto,
  ) {
    return this.cuentas.update(id, dto);
  }

  /**
   * Soft-delete: archiva la cuenta (activa = false). Nunca borramos
   * físicamente porque las transacciones históricas la apuntan vía
   * snapshot `cuentaId` y necesitamos preservar trazabilidad contable.
   */
  @Delete(':id')
  @ApiOperation({ summary: 'Archivar cuenta (soft-delete)' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.archive(id);
  }

  @Post(':id/restaurar')
  @ApiOperation({ summary: 'Reactivar una cuenta archivada' })
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.restore(id);
  }

  // ─────────── Resumen / KPIs ───────────
  @Get(':id/resumen')
  @ApiOperation({
    summary:
      'Resumen financiero de la cuenta: presupuestos, ingresos, egresos, ejecutado, disponible',
  })
  resumen(@Param('id', ParseIntPipe) id: number) {
    return this.cuentas.resumen(id);
  }

  // ─────── Asignación de proyectos / programas ───────
  @Post(':id/proyectos/:projectId')
  @ApiOperation({
    summary:
      'Asignar (o mover) un proyecto a esta cuenta. Las transacciones viejas conservan su cuenta original.',
  })
  asignarProyecto(
    @Param('id', ParseIntPipe) id: number,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.cuentas.asignarProyecto(id, projectId);
  }

  @Delete(':id/proyectos/:projectId')
  @ApiOperation({ summary: 'Desasignar un proyecto de esta cuenta' })
  desasignarProyecto(
    @Param('id', ParseIntPipe) id: number,
    @Param('projectId', ParseIntPipe) projectId: number,
  ) {
    return this.cuentas.desasignarProyecto(id, projectId);
  }

  @Post(':id/programas/:programaId')
  @ApiOperation({
    summary:
      'Asignar (o mover) un programa a esta cuenta. Las transacciones viejas conservan su cuenta original.',
  })
  asignarPrograma(
    @Param('id', ParseIntPipe) id: number,
    @Param('programaId', ParseIntPipe) programaId: number,
  ) {
    return this.cuentas.asignarPrograma(id, programaId);
  }

  @Delete(':id/programas/:programaId')
  @ApiOperation({ summary: 'Desasignar un programa de esta cuenta' })
  desasignarPrograma(
    @Param('id', ParseIntPipe) id: number,
    @Param('programaId', ParseIntPipe) programaId: number,
  ) {
    return this.cuentas.desasignarPrograma(id, programaId);
  }
}

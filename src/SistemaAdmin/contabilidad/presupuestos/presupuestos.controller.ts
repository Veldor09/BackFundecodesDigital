// src/SistemaAdmin/contabilidad/presupuestos/presupuestos.controller.ts
import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PresupuestosService } from './presupuestos.service';
import { CreatePresupuestoDto, UpdatePresupuestoDto } from './dto/create-presupuesto.dto';

// ⬇️ Guards y permisos (ajusta rutas si fuera necesario)
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';

@ApiTags('Contabilidad - Presupuestos')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('contabilidad:access')
@Controller('contabilidad/presupuestos')
export class PresupuestosController {
  constructor(private service: PresupuestosService) {}

  @Post()
  @ApiResponse({ status: 201, description: 'Creado' })
  create(@Body() dto: CreatePresupuestoDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiQuery({ name: 'mes', required: false, type: Number })
  @ApiQuery({ name: 'anio', required: false, type: Number })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('mes') mes?: string,
    @Query('anio') anio?: string,
  ) {
    return this.service.findAll({
      projectId: projectId ? Number(projectId) : undefined,
      mes: mes ? Number(mes) : undefined,
      anio: anio ? Number(anio) : undefined,
    });
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdatePresupuestoDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.remove(id);
  }
}

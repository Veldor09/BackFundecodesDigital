import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { AreasService } from './areas.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Áreas')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('collaborators:access') // mismo nivel que el módulo admin
@Controller('areas')
export class AreasController {
  constructor(private readonly service: AreasService) {}

  // GET /areas/selector — lista compacta para formularios (sin autenticación extra)
  @Get('selector')
  @ApiOperation({ summary: 'Lista compacta de áreas activas para selectores' })
  selector() {
    return this.service.selector();
  }

  // GET /areas
  @Get()
  @ApiOperation({ summary: 'Listar áreas con filtros y paginación' })
  @ApiQuery({ name: 'q', required: false })
  @ApiQuery({ name: 'activa', required: false, type: Boolean })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  list(
    @Query('q') q?: string,
    @Query('activa') activa?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.service.list({
      q,
      activa: activa === undefined ? undefined : activa === 'true',
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
    });
  }

  // GET /areas/:id
  @Get(':id')
  @ApiOperation({ summary: 'Obtener área por ID (incluye proyectos, programas y cuenta)' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  // GET /areas/:id/saldo — saldo disponible del área (sin permisos especiales: solo JWT)
  @Get(':id/saldo')
  @ApiOperation({ summary: 'Saldo disponible del área vía su cuenta contable' })
  getSaldo(@Param('id', ParseIntPipe) id: number) {
    return this.service.getSaldo(id);
  }

  // POST /areas
  @Post()
  @ApiOperation({ summary: 'Crear área' })
  create(@Body() dto: CreateAreaDto) {
    return this.service.create(dto);
  }

  // PATCH /areas/:id
  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar área' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.service.update(id, dto);
  }

  // POST /areas/:id/archivar
  @Post(':id/archivar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Archivar (desactivar) un área' })
  archive(@Param('id', ParseIntPipe) id: number) {
    return this.service.archive(id);
  }

  // POST /areas/:id/restaurar
  @Post(':id/restaurar')
  @HttpCode(200)
  @ApiOperation({ summary: 'Restaurar (reactivar) un área' })
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.service.restore(id);
  }

  // DELETE /areas/:id
  @Delete(':id')
  @HttpCode(200)
  @ApiOperation({ summary: 'Eliminar área (desvincula proyectos, programas y colaboradores)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

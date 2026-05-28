import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { VolunteerService } from './volunteer.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';
import { UpdateVolunteerDto } from './dto/update-volunteer.dto';
import { Audit } from '../auditoria/audit.decorator';

@ApiTags('Voluntarios')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('voluntario:access')
@Controller('voluntarios')
export class VolunteerController {
  constructor(private readonly volunteerService: VolunteerService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar voluntario' })
  @Audit({
    accion: 'VOLUNTARIO_CREAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ result }) =>
      `Registró voluntario "${(result as any)?.nombre ?? ''}".`,
  })
  create(@Body() dto: CreateVolunteerDto) {
    return this.volunteerService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar voluntarios (paginado, con búsqueda)' })
  @ApiQuery({ name: 'q', required: false, description: 'Búsqueda por nombre, ong o nacionalidad' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean, description: 'Excluir voluntarios con fechaSalida pasada' })
  findAll(
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.volunteerService.findAll({
      q,
      page: page ? Number(page) : 1,
      pageSize: pageSize ? Number(pageSize) : 20,
      soloActivos: soloActivos === 'true',
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener voluntario por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar voluntario' })
  @Audit({
    accion: 'VOLUNTARIO_EDITAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ params }) => `Editó voluntario #${params.id}.`,
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateVolunteerDto) {
    return this.volunteerService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar voluntario' })
  @Audit({
    accion: 'VOLUNTARIO_ELIMINAR',
    entidad: 'Voluntario',
    resolveDetalle: ({ params }) => `Eliminó voluntario #${params.id}.`,
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.volunteerService.remove(id);
  }
}

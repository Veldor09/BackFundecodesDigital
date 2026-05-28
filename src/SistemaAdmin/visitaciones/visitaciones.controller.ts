import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { VisitacionesService } from './visitaciones.service';
import { CreateVisitacionDto } from './dto/create-visitacion.dto';
import { UpdateVisitacionDto } from './dto/update-visitacion.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../auditoria/audit.decorator';

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('visitaciones:access')
@Controller('visitaciones')
export class VisitacionesController {
  constructor(private readonly service: VisitacionesService) {}

  @Post()
  @Audit({
    accion: 'VISITACION_CREAR',
    entidad: 'Visitacion',
    resolveDetalle: ({ result }) => {
      const r = result as any;
      return `Registró visita del ${r?.fecha?.toISOString?.()?.slice(0, 10) ?? '?'}: ${r?.totalPersonas ?? 0} personas (${r?.nacionales ?? 0} nac. / ${r?.extranjeros ?? 0} ext.).`;
    },
  })
  create(@Body() dto: CreateVisitacionDto) {
    return this.service.create(dto);
  }

  @Get()
  findAll(
    @Query('page')  page?:  string,
    @Query('limit') limit?: string,
    @Query('q')     q?:     string,
  ) {
    return this.service.findAll({
      page:  page  ? Number(page)  : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Put(':id')
  @Audit({
    accion: 'VISITACION_EDITAR',
    entidad: 'Visitacion',
    resolveDetalle: ({ params }) => `Editó visitación #${params.id}.`,
  })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVisitacionDto,
  ) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @Audit({
    accion: 'VISITACION_ELIMINAR',
    entidad: 'Visitacion',
    resolveDetalle: ({ params }) => `Eliminó visitación #${params.id}.`,
  })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

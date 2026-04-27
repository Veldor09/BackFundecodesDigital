// src/SistemaAdmin/auditoria/auditoria.controller.ts
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AdminOnlyGuard } from './admin-only.guard';
import { AuditoriaService } from './auditoria.service';
import { ListAuditoriaDto } from './dto/list-auditoria.dto';

@ApiTags('Auditoría')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, AdminOnlyGuard)
@Controller('auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar eventos de auditoría (solo admin)',
    description:
      'Devuelve eventos paginados ordenados por fecha descendente. ' +
      'Soporta filtros por usuario, acción, entidad, rango de fechas y búsqueda libre.',
  })
  @ApiOkResponse({ description: 'Listado paginado de auditoría' })
  list(@Query() query: ListAuditoriaDto) {
    return this.auditoria.findAll(query);
  }
}

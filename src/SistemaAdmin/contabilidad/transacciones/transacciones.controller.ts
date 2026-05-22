import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { TransaccionesService } from './transacciones.service';
import {
  CreateTransaccionDto,
  AnularTransaccionDto,
} from './dto/create-transaccion.dto';
import { JwtAuthGuard } from '../../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Permissions } from '../../../common/decorators/permissions.decorator';
import { Audit } from '../../auditoria/audit.decorator';

@ApiTags('Contabilidad - Transacciones')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('contabilidad:access')
@Controller('contabilidad/transacciones')
export class TransaccionesController {
  constructor(private service: TransaccionesService) {}

  @Post()
  @Audit({
    accion: 'CONTABILIDAD_TRANSACCION_CREAR',
    entidad: 'Transaccion',
    resolveDetalle: ({ result }) => {
      const r = result as any;
      const destino = r?.projectId
        ? `proyecto #${r.projectId}`
        : `programa #${r.programaId}`;
      return `Registró ${r?.tipo ?? '?'} de ${r?.moneda ?? 'CRC'} ${r?.monto ?? '?'} en ${destino} (${r?.categoria ?? ''}).`;
    },
  })
  create(@Body() dto: CreateTransaccionDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiQuery({ name: 'programaId', required: false, type: Number })
  @ApiQuery({ name: 'cuentaId', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ingreso', 'egreso'] })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'fechaInicio', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'fechaFin', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'moneda', required: false, enum: ['CRC', 'USD', 'EUR'] })
  @ApiQuery({ name: 'incluirAnuladas', required: false, type: Boolean })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('programaId') programaId?: string,
    @Query('cuentaId') cuentaId?: string,
    @Query('tipo') tipo?: 'ingreso' | 'egreso',
    @Query('categoria') categoria?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('moneda') moneda?: 'CRC' | 'USD' | 'EUR',
    @Query('incluirAnuladas') incluirAnuladas?: string,
  ) {
    return this.service.findAll({
      projectId: projectId ? Number(projectId) : undefined,
      programaId: programaId ? Number(programaId) : undefined,
      cuentaId: cuentaId ? Number(cuentaId) : undefined,
      tipo,
      categoria,
      fechaInicio,
      fechaFin,
      moneda,
      incluirAnuladas: incluirAnuladas === 'true',
    });
  }

  @Get('saldo/proyecto/:id')
  @Audit({
    accion: 'CONTABILIDAD_SALDO_PROYECTO',
    entidad: 'Proyecto',
    resolveDetalle: ({ params }) => `Consultó saldo de proyecto #${params.id}.`,
  })
  saldoProyecto(@Param('id', ParseIntPipe) id: number) {
    return this.service.saldoProyecto(id);
  }

  @Get('saldo/programa/:id')
  @Audit({
    accion: 'CONTABILIDAD_SALDO_PROGRAMA',
    entidad: 'ProgramaVoluntariado',
    resolveDetalle: ({ params }) => `Consultó saldo de programa #${params.id}.`,
  })
  saldoPrograma(@Param('id', ParseIntPipe) id: number) {
    return this.service.saldoPrograma(id);
  }

  @Post(':id/anular')
  @HttpCode(200)
  @Audit({
    accion: 'CONTABILIDAD_TRANSACCION_ANULAR',
    entidad: 'Transaccion',
    resolveDetalle: ({ params, body }) =>
      `Anuló transacción ${params.id}. Motivo: ${(body as any)?.motivo ?? '—'}.`,
  })
  anular(
    @Param('id') id: string,
    @Body() dto: AnularTransaccionDto,
    @Req() req: Request & { user?: { id?: number; userId?: number } },
  ) {
    const userId = req.user?.userId ?? req.user?.id ?? undefined;
    return this.service.anular(id, dto.motivo, userId);
  }
}

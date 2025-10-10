import { Controller, Get, Post, Patch, Delete, Param, Body, Query, HttpCode } from '@nestjs/common'
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger'
import { TransaccionesService } from './transacciones.service'
import { CreateTransaccionDto, UpdateTransaccionDto } from './dto/create-transaccion.dto'

@ApiTags('Contabilidad - Transacciones')
@ApiBearerAuth('bearer')
@Controller('contabilidad/transacciones')
export class TransaccionesController {
  constructor(private service: TransaccionesService) {}

  @Post()
  create(@Body() dto: CreateTransaccionDto) {
    return this.service.create(dto)
  }

  @Get()
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  @ApiQuery({ name: 'tipo', required: false, enum: ['ingreso', 'egreso'] })
  @ApiQuery({ name: 'categoria', required: false })
  @ApiQuery({ name: 'fechaInicio', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'fechaFin', required: false, description: 'YYYY-MM-DD' })
  @ApiQuery({ name: 'moneda', required: false, enum: ['CRC','USD','EUR'] })
  findAll(
    @Query('projectId') projectId?: string,
    @Query('tipo') tipo?: 'ingreso' | 'egreso',
    @Query('categoria') categoria?: string,
    @Query('fechaInicio') fechaInicio?: string,
    @Query('fechaFin') fechaFin?: string,
    @Query('moneda') moneda?: 'CRC'|'USD'|'EUR',
  ) {
    return this.service.findAll({
      projectId: projectId ? Number(projectId) : undefined,
      tipo, categoria, fechaInicio, fechaFin, moneda,
    })
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTransaccionDto) {
    return this.service.update(id, dto)
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    await this.service.remove(id)
  }
}

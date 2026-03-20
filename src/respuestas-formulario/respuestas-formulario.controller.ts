import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RespuestasFormularioService } from './respuestas-formulario.service';
import { CreateRespuestaFormularioDto } from './dto/create-respuesta-formulario.dto';
import { QueryRespuestaFormularioDto } from './dto/query-respuesta-formulario.dto';
import { UpdateEstadoRespuestaDto } from './dto/update-estado-respuesta.dto';

@Controller('respuestas-formulario')
export class RespuestasFormularioController {
  constructor(
    private readonly respuestasFormularioService: RespuestasFormularioService,
  ) {}

  @Post()
  create(@Body() dto: CreateRespuestaFormularioDto) {
    return this.respuestasFormularioService.create(dto);
  }

  @Get()
  findAll(@Query() query: QueryRespuestaFormularioDto) {
    return this.respuestasFormularioService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.respuestasFormularioService.findOne(id);
  }

  @Patch(':id/estado')
  updateEstado(
    @Param('id') id: string,
    @Body() dto: UpdateEstadoRespuestaDto,
  ) {
    return this.respuestasFormularioService.updateEstado(id, dto);
  }
}
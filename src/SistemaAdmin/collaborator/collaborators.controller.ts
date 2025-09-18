import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  HttpCode,
} from '@nestjs/common';
import { CollaboratorsService } from './collaborators.service';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { ListCollaboratorsQuery } from './dto/list-collaborators.query';
import { CollaboratorRol } from './dto/collaborator-rol.enum';
import { CollaboratorEstado } from './dto/collaborator-estado.enum';

@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly service: CollaboratorsService) {}

  @Post()
  async create(@Body() dto: CreateCollaboratorDto) {
    const created = await this.service.create({
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      cedula: dto.cedula,
      fechaNacimiento: dto.fechaNacimiento ?? null,
      telefono: dto.telefono ?? null,
      rol: (dto.rol as CollaboratorRol) ?? undefined,
      password: dto.password,
      estado: (dto.estado as CollaboratorEstado) ?? undefined,
    });
    return created;
  }

  @Get()
  list(@Query() q: ListCollaboratorsQuery) {
    return this.service.list({
      q: q.q,
      rol: q.rol,
      estado: q.estado,
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 10,
    });
  }

  @Get(':id')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  /**
   * Endpoint auxiliar de verificación previa:
   * Devuelve { safe: boolean, reason?: string } indicando si es seguro
   * aplicar un cambio de rol/estado sin dejar al sistema sin admins activos.
   *
   * Uso típico desde el front:
   *   GET /collaborators/123/safety?nextRol=COLABORADOR&nextEstado=ACTIVO
   */
  @Get(':id/safety')
  async checkSafety(
    @Param('id', ParseIntPipe) id: number,
    @Query('nextRol') nextRol?: CollaboratorRol,
    @Query('nextEstado') nextEstado?: CollaboratorEstado,
  ) {
    // Si no pasan valores, usamos los actuales para no romper:
    const current = await this.service.findById(id);
    const rol = (nextRol as CollaboratorRol) ?? (current.rol as CollaboratorRol);
    const estado =
      (nextEstado as CollaboratorEstado) ??
      (current.estado as CollaboratorEstado);

    return this.service.checkAdminChangeSafety(id, rol, estado);
  }

  @Patch(':id')
  @HttpCode(204)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollaboratorDto,
  ) {
    await this.service.update(id, {
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      cedula: dto.cedula,
      fechaNacimiento: dto.fechaNacimiento,
      telefono: dto.telefono,
      rol: dto.rol,
      password: dto.password,
      estado: dto.estado,
    });
    return; // 204 sin body
  }

  @Patch(':id/deactivate')
  @HttpCode(204)
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    await this.service.deactivate(id);
    return; // 204 sin body
  }

  @Patch(':id/issue-temp-password')
  @HttpCode(204)
  async issueTempPassword(@Param('id', ParseIntPipe) id: number) {
    await this.service.issueTemporaryPassword(id);
    return; // 204 sin body
  }
}

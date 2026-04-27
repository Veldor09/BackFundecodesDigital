// src/collaborators/collaborators.controller.ts
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CollaboratorsService } from './collaborators.service';
import { CreateCollaboratorDto } from './dto/create-collaborator.dto';
import { UpdateCollaboratorDto } from './dto/update-collaborator.dto';
import { ListCollaboratorsQuery } from './dto/list-collaborators.query';
import { CollaboratorRol } from './dto/collaborator-rol.enum';
import { CollaboratorEstado } from './dto/collaborator-estado.enum';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Audit } from '../auditoria/audit.decorator';

@ApiTags('Colaboradores')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('collaborators:access')
@Controller('collaborators')
export class CollaboratorsController {
  constructor(private readonly service: CollaboratorsService) {}

  // ---------- CREATE ----------
  @Post()
  @ApiOperation({ summary: 'Crear colaborador' })
  @ApiResponse({ status: 201, description: 'Creado' })
  @Audit({
    accion: 'COLABORADOR_CREAR',
    entidad: 'Colaborador',
    resolveDetalle: ({ result }) => {
      const r = result as any;
      return `Creó colaborador "${r?.nombreCompleto ?? ''}" (${r?.correo ?? ''}) con rol ${r?.rol ?? '?'}.`;
    },
  })
  async create(@Body() dto: CreateCollaboratorDto) {
    const created = await this.service.create({
      nombreCompleto: dto.nombreCompleto,
      correo: dto.correo,
      cedula: dto.cedula,
      fechaNacimiento: dto.fechaNacimiento ?? null,
      telefono: dto.telefono ?? null,
      // roles ya son minúscula en el enum (admin | colaboradorfactura | ...)
      rol: dto.rol ?? undefined,
      password: dto.password,
      estado: dto.estado ?? undefined,
    });
    return created;
  }

  // ---------- LIST ----------
  @Get()
  @ApiOperation({ summary: 'Listar colaboradores (paginado)' })
  async list(@Query() q: ListCollaboratorsQuery) {
    return this.service.list({
      q: q.q,
      rol: q.rol,        // validado en el DTO (minúscula)
      estado: q.estado,  // validado en el DTO (ACTIVO/INACTIVO)
      page: q.page ?? 1,
      pageSize: q.pageSize ?? 10,
    });
  }

  // ---------- GET ----------
  @Get(':id')
  @ApiOperation({ summary: 'Obtener colaborador por ID' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.service.findById(id);
  }

  /**
   * Verificación de seguridad antes de aplicar cambios de rol/estado.
   * GET /collaborators/:id/safety?nextRol=colaboradorproyecto&nextEstado=ACTIVO
   */
  @Get(':id/safety')
  @ApiOperation({ summary: 'Verifica si es seguro cambiar rol/estado' })
  @ApiQuery({
    name: 'nextRol',
    required: false,
    enum: CollaboratorRol,
    description:
      'Próximo rol (admin | colaboradorfactura | colaboradorvoluntariado | colaboradorproyecto | colaboradorcontabilidad)',
  })
  @ApiQuery({
    name: 'nextEstado',
    required: false,
    enum: CollaboratorEstado,
    description: 'Próximo estado (ACTIVO | INACTIVO)',
  })
  async checkSafety(
    @Param('id', ParseIntPipe) id: number,
    @Query('nextRol') nextRol?: string,
    @Query('nextEstado') nextEstado?: string,
  ) {
    const current = await this.service.findById(id);

    // Normalizamos por si llegan en otro casing
    const rol = ((nextRol ?? (current.rol as string)) || '')
      .toLowerCase() as CollaboratorRol;
    const estado = ((nextEstado ?? (current.estado as string)) || '')
      .toUpperCase() as CollaboratorEstado;

    return this.service.checkAdminChangeSafety(id, rol, estado);
  }

  // ---------- UPDATE ----------
  @Patch(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Actualizar colaborador (204 No Content)' })
  @Audit({
    accion: 'COLABORADOR_EDITAR',
    entidad: 'Colaborador',
    resolveDetalle: ({ params, body }) => {
      const cambios: string[] = [];
      if (body?.rol) cambios.push(`rol→${body.rol}`);
      if (body?.estado) cambios.push(`estado→${body.estado}`);
      if (body?.correo) cambios.push(`correo→${body.correo}`);
      const resumen = cambios.length ? ` (${cambios.join(', ')})` : '';
      return `Editó colaborador #${params.id}${resumen}.`;
    },
  })
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
      rol: dto.rol,          // ya validado/minúscula en DTO
      password: dto.password,
      estado: dto.estado,    // ya validado/upper en DTO
    });
    return; // 204
  }

  // ---------- TOGGLE STATUS (ACTIVO/INACTIVO) ----------
  // PATCH /collaborators/:id/toggle-status
  @Patch(':id/toggle-status')
  @ApiOperation({ summary: 'Alternar estado (ACTIVO/INACTIVO)' })
  @Audit({
    accion: 'COLABORADOR_TOGGLE_ESTADO',
    entidad: 'Colaborador',
    resolveDetalle: ({ params, result }) =>
      `Alternó estado de colaborador #${params.id} → ${(result as any)?.estado ?? '?'}.`,
  })
  async toggleStatus(@Param('id', ParseIntPipe) id: number) {
    // Devuelve el colaborador actualizado (200 OK)
    return this.service.toggleStatus(id);
  }

  // ---------- DEACTIVATE (si lo sigues usando) ----------
  @Patch(':id/deactivate')
  @HttpCode(204)
  @ApiOperation({ summary: 'Desactivar colaborador (idempotente)' })
  @Audit({
    accion: 'COLABORADOR_DESACTIVAR',
    entidad: 'Colaborador',
    resolveDetalle: ({ params }) => `Desactivó colaborador #${params.id}.`,
  })
  async deactivate(@Param('id', ParseIntPipe) id: number) {
    await this.service.deactivate(id);
    return; // 204
  }

  // ---------- ISSUE TEMP PASSWORD ----------
  @Patch(':id/issue-temp-password')
  @HttpCode(204)
  @ApiOperation({ summary: 'Emitir contraseña temporal' })
  @Audit({
    accion: 'COLABORADOR_PASS_TEMPORAL',
    entidad: 'Colaborador',
    resolveDetalle: ({ params }) =>
      `Emitió contraseña temporal para colaborador #${params.id}.`,
  })
  async issueTempPassword(@Param('id', ParseIntPipe) id: number) {
    await this.service.issueTemporaryPassword(id);
    return; // 204
  }

  // ---------- DELETE ----------
  @Delete(':id')
  @HttpCode(204)
  @ApiOperation({ summary: 'Eliminar colaborador' })
  @Audit({
    accion: 'COLABORADOR_ELIMINAR',
    entidad: 'Colaborador',
    resolveDetalle: ({ params }) => `Eliminó colaborador #${params.id}.`,
  })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.service.remove(id);
    return; // 204
  }
}

// src/SistemaAdmin/projects/projects.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  Post,
  Body,
  Patch,
  Delete,
  ParseIntPipe,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Response } from 'express';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsQuery } from './dto/list-projects.query';
import { AddImageUrlDto } from './dto/add-image-url.dto';
import { AddDocumentUrlDto } from './dto/add-document-url.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';

// ⬇️ Guards y permisos
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';
import { Public } from '../../common/decorators/public.decorator'; // ✅ añadido

// Helper para normalizar enlaces de Google Drive
function normalizeDriveUrl(url: string): string {
  const m = url?.match(/\/file\/d\/([^/]+)\//);
  if (m?.[1]) return `https://drive.google.com/uc?id=${m[1]}`;
  return url;
}

@ApiTags('projects')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('projects:access')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // -------------------- LISTA --------------------
  @ApiQuery({
    name: 'includeVols',
    required: false,
    description:
      'Incluye asignaciones (voluntarios) solo cuando se pida. Valores: 1/true | 0/false',
    schema: { type: 'string', enum: ['0', '1', 'true', 'false'] },
  })
  @Public() // ✅ permite a la landing listar proyectos sin token
  @Get()
  list(@Query() query: ListProjectsQuery) {
    return this.service.list(query);
  }

  // -------------------- DETALLE con caché HTTP + ETag --------------------
  @ApiQuery({
    name: 'ttl',
    required: false,
    description:
      'Tiempo de cacheo en segundos (Cache-Control: public, max-age=ttl). Default 60.',
    schema: { type: 'integer', default: 60, minimum: 0 },
  })
  @ApiQuery({
    name: 'includeVols',
    required: false,
    description:
      'Incluye asignaciones (voluntarios) solo cuando se pida. Valores: 1/true | 0/false',
    schema: { type: 'string', enum: ['0', '1', 'true', 'false'] },
  })
  @Public() // ✅ detalle de proyecto también público
  @Get(':idOrSlug')
  async get(
    @Param('idOrSlug') idOrSlug: string,
    @Query('ttl', new DefaultValuePipe('60')) ttl: string,
    @Query('includeVols') includeVols: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.service.findOne(
      idOrSlug,
      includeVols === '1' || includeVols === 'true',
    );

    const seconds = Math.max(0, Number.isFinite(+ttl) ? +ttl : 60);
    res.setHeader(
      'Cache-Control',
      `public, max-age=${seconds}, stale-while-revalidate=120`,
    );

    const etagBase = (data as any).updatedAt
      ? new Date((data as any).updatedAt).toISOString()
      : '';
    const etag = `"proj-${(data as any).id}-${etagBase}"`;
    res.setHeader('ETag', etag);

    const inm = res.req.headers['if-none-match'];
    if (inm && inm === etag) return res.status(304).send();

    return res.status(200).json(data);
  }

  // -------------------- CREAR --------------------
  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  // -------------------- ACTUALIZAR --------------------
  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  // -------------------- ELIMINAR --------------------
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // ===================== ASIGNACIONES =====================
  @Post(':id/volunteers/:voluntarioId')
  assignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Param('voluntarioId', ParseIntPipe) voluntarioId: number,
  ) {
    return this.service.assignVolunteer(id, voluntarioId);
  }

  @Delete(':id/volunteers/:voluntarioId')
  unassignVolunteer(
    @Param('id', ParseIntPipe) id: number,
    @Param('voluntarioId', ParseIntPipe) voluntarioId: number,
  ) {
    return this.service.unassignVolunteer(id, voluntarioId);
  }

  // ===================== IMÁGENES (por URL) =====================
  @Post(':id/add-image-url')
  @ApiBody({
    description: 'Agregar imagen por URL al proyecto (sin subir archivo)',
    type: AddImageUrlDto,
  })
  async addImageByUrl(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddImageUrlDto,
  ) {
    if (!body?.url) throw new BadRequestException('url es requerido');

    const normalized = normalizeDriveUrl(body.url);
    const rawOrder = (body as any).order;
    const parsedOrder =
      typeof rawOrder === 'number' ? rawOrder : Number(rawOrder);
    const safeOrder = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    return this.service.addImage(id, {
      url: normalized,
      alt: (body.alt ?? '').trim() || undefined,
      order: safeOrder,
    });
  }

  // ===================== DOCUMENTOS =====================
  @Get(':id/documents')
  async getProjectDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProjectDocuments(id);
  }

@Post(':id/documents')
@UseInterceptors(FileInterceptor('file'))
@ApiConsumes('multipart/form-data')
@ApiBody({
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
    required: ['file'],
  },
})
async uploadProjectDocument(
  @Param('id', ParseIntPipe) id: number,
  @UploadedFile() file: Express.Multer.File,
) {
  if (!file) throw new BadRequestException('Archivo requerido (file)');
  return this.service.uploadProjectDocument(id, file);
}


  @Delete(':id/documents/:documentId')
  async deleteProjectDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.service.removeDocumentById(id, documentId);
  }

  @Delete(':id/documents')
  async deleteProjectDocumentLegacy(
    @Param('id', ParseIntPipe) id: number,
    @Query('name') name?: string,
    @Body('url') url?: string,
  ) {
    const raw = name ?? url ?? '';
    if (!raw)
      throw new BadRequestException('name (query) o url (body) es requerido');
    const base = raw.includes('/') ? (raw.split('/').pop() ?? '') : raw;
    const decoded = decodeURIComponent(base);
    return this.service.removeDocumentByName(id, decoded);
  }
}

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
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
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

// Helper para normalizar enlaces de Google Drive
function normalizeDriveUrl(url: string): string {
  const m = url?.match(/\/file\/d\/([^/]+)\//);
  if (m?.[1]) return `https://drive.google.com/uc?id=${m[1]}`;
  return url;
}

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // -------------------- LISTA --------------------
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
  @Get(':idOrSlug')
  async get(
    @Param('idOrSlug') idOrSlug: string,
    @Query('ttl', new DefaultValuePipe('60')) ttl: string,
    @Res() res: Response,
  ) {
    const data = await this.service.findOne(idOrSlug);

    const seconds = Math.max(0, Number.isFinite(+ttl) ? +ttl : 60);
    res.setHeader('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=120`);

    const etagBase = data.updatedAt ? new Date(data.updatedAt).toISOString() : '';
    const etag = `"proj-${data.id}-${etagBase}"`;
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

  // -------------------- AGREGAR IMAGEN POR URL (Drive/CDN) --------------------
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
    const parsedOrder = typeof rawOrder === 'number' ? rawOrder : Number(rawOrder);
    const safeOrder = Number.isFinite(parsedOrder) ? parsedOrder : 0;

    return this.service.addImage(id, {
      url: normalized,
      alt: (body.alt ?? '').trim() || undefined,
      order: safeOrder,
    });
  }

  // -------------------- AGREGAR DOCUMENTO POR URL --------------------
  @Post(':id/add-document-url')
  @ApiBody({
    description: 'Agregar documento por URL al proyecto (sin subir archivo)',
    type: AddDocumentUrlDto,
  })
  async addDocumentByUrl(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: AddDocumentUrlDto,
  ) {
    try {
      if (!body?.url) throw new BadRequestException('url es requerido');
      if (!body?.name) throw new BadRequestException('name es requerido');

      return await this.service.addDocument(id, body);
    } catch (error) {
      // log visible en servidor
      // eslint-disable-next-line no-console
      console.error('❌ Error en addDocumentByUrl:', error);
      throw error;
    }
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

  // ===================== DOCUMENTOS: ENDPOINTS =====================

  /**
   * LISTAR documentos de un proyecto
   * GET /projects/:id/documents
   */
  @Get(':id/documents')
  async getProjectDocuments(@Param('id', ParseIntPipe) id: number) {
    return this.service.getProjectDocuments(id);
  }

  /**
   * SUBIR documento (archivo local)
   * POST /projects/:id/documents
   */
  @Post(':id/documents')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const dest = join(process.cwd(), 'uploads', 'projects', 'docs');
          fs.mkdirSync(dest, { recursive: true });
          cb(null, dest);
        },
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (req, file, cb) => {
        const allowed = ['.pdf', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.gif'];
        const ext = extname(file.originalname).toLowerCase();
        if (!allowed.includes(ext)) {
          return cb(new BadRequestException('Tipo de archivo no permitido'), false);
        }
        cb(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
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

  /**
   * ELIMINAR documento de un proyecto (✅ por ID — recomendado)
   * DELETE /projects/:id/documents/:documentId
   */
  @Delete(':id/documents/:documentId')
  @ApiParam({ name: 'id', type: Number, required: true, description: 'ID del proyecto' })
  @ApiParam({ name: 'documentId', type: Number, required: true, description: 'ID del documento' })
  async deleteProjectDocumentById(
    @Param('id', ParseIntPipe) id: number,
    @Param('documentId', ParseIntPipe) documentId: number,
  ) {
    return this.service.removeDocumentById(id, documentId);
  }

  /**
   * ELIMINAR documento de un proyecto (compat: por nombre/URL)
   * DELETE /projects/:id/documents?name=<encoded>
   * ó enviar body { "url": "..." } (se extrae el nombre)
   */
  @Delete(':id/documents')
  @ApiQuery({
    name: 'name',
    required: false,
    description: 'Nombre del archivo a eliminar (URL-encoded). Alternativa: enviar body {url}.',
  })
  async deleteProjectDocumentLegacy(
    @Param('id', ParseIntPipe) id: number,
    @Query('name') name?: string,
    @Body('url') url?: string,
  ) {
    // Soporta ambos: ?name= y body.url para compatibilidad
    const raw = name ?? url ?? '';
    if (!raw) throw new BadRequestException('name (query) o url (body) es requerido');
    // Normaliza: si viene una URL, extrae el nombre
    const base = raw.includes('/') ? raw.split('/').pop() ?? '' : raw;
    const decoded = decodeURIComponent(base);
    return this.service.removeDocumentByName(id, decoded);
  }
}

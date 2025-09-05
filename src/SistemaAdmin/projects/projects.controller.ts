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
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
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
    @Query('ttl') ttl: string | undefined,
    @Res() res: Response,
  ) {
    const data = await this.service.findOne(idOrSlug);

    const parsed = Number(ttl);
    const seconds = Number.isFinite(parsed) && parsed >= 0 ? parsed : 60;
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
      alt: body.alt?.trim() || undefined,
      order: safeOrder,
    });
  }

  // -------------------- AGREGAR DOCUMENTO POR URL --------------------
@Post(':id/add-document-url')
@ApiBody({
  description: 'Agregar documento por URL al proyecto (PDF, DOCX, etc.)',
  type: AddDocumentUrlDto,
})
async addDocumentByUrl(
  @Param('id', ParseIntPipe) id: number,
  @Body() body: AddDocumentUrlDto,
) {
  try {
    if (!body?.url) throw new BadRequestException('url es requerido');
    if (!body?.name) throw new BadRequestException('name es requerido');

    return await this.service.addDocument(id, {
      url: body.url,
      name: body.name,
      mimeType: body.mimeType || 'application/octet-stream',
      size: body.size || 0,
    });
  } catch (error) {
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

  // ===================== DOCUMENTOS: NUEVOS ENDPOINTS =====================

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
  async uploadProjectDocument(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.service.uploadProjectDocument(id, file);
  }

  /**
   * ELIMINAR documento de un proyecto
   * DELETE /projects/:id/documents
   */
  @Delete(':id/documents')
  async deleteProjectDocument(
    @Param('id', ParseIntPipe) id: number,
    @Body('url') url: string,
  ) {
    if (!url) throw new BadRequestException('url es requerido en el body');
    return this.service.removeDocument(id, url);
  }
}
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../../common/decorators/public.decorator';
import { StorageService } from '../../common/storage/storage.service';

type CommentStatus = 'PENDIENTE' | 'APROBADO' | 'DENEGADO';

/** Tipos MIME permitidos para adjuntos de comentarios */
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
]);

/** 10 MB en bytes */
const MAX_SIZE = 10 * 1024 * 1024;

@Controller('comments')
export class CommentsController {
  constructor(
    private readonly service: CommentsService,
    private readonly storage: StorageService,
  ) {}

  @Public()
  @Get('public')
  async getPublic() {
    return this.service.getPublicComments();
  }

  @Public()
  @Post('public')
  async createPublic(@Body() dto: CreateCommentDto) {
    return this.service.createPublicComment(dto);
  }

  /**
   * Subida pública de adjunto para comentarios.
   * Devuelve { url, key } que luego se incluye al enviar el comentario.
   * Acepta: imágenes (jpg/png/webp/gif) y video (mp4/webm), máx 10 MB.
   */
  @Public()
  @Post('upload-attachment')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Archivo requerido (field "file")');
    if (!ALLOWED_MIME.has(file.mimetype))
      throw new BadRequestException(
        'Tipo de archivo no permitido. Solo imágenes (jpg/png/webp/gif) o video (mp4/webm).',
      );
    if (file.size > MAX_SIZE)
      throw new BadRequestException('El archivo no puede superar 10 MB.');

    const uploaded = await this.storage.upload(
      file.buffer,
      file.mimetype,
      file.originalname,
      'comments',
    );
    return { url: uploaded.url, key: uploaded.key };
  }

  @Get('admin')
  async getAdmin(
    @Query('status') status?: CommentStatus,
    @Query('search') search?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getAdminComments({
      status,
      search,
      from,
      to,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
    });
  }

  @Public()
  @Get('admin/pending-count')
  async getPendingCount() {
    return this.service.getPendingCount();
  }

  @Patch(':id/approve')
  async approve(@Param('id') id: string) {
    return this.service.approveComment(id);
  }

  @Patch(':id/deny')
  async deny(@Param('id') id: string) {
    return this.service.denyComment(id);
  }

  @Delete(':id')
  async deleteComment(@Param('id') id: string) {
    return this.service.deleteComment(id);
  }
}

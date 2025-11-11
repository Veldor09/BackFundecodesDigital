import { Body, Controller, Get, Post } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../../common/decorators/public.decorator';

@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

  // ✅ Público: obtener comentarios
  @Public()
  @Get()
  async getAll() {
    return this.service.findAll();
  }

  // ✅ Público: agregar comentario
  @Public()
  @Post()
  async create(@Body() dto: CreateCommentDto) {
    return this.service.create(dto);
  }
}

import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { Public } from '../../common/decorators/public.decorator';

type CommentStatus = 'PENDIENTE' | 'APROBADO' | 'DENEGADO';

@Controller('comments')
export class CommentsController {
  constructor(private readonly service: CommentsService) {}

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

  @Get('admin')
  async getAdmin(@Query('status') status?: CommentStatus) {
    return this.service.getAdminComments(status);
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
}
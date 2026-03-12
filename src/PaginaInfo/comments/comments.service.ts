import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentStatus = 'PENDIENTE' | 'APROBADO' | 'DENEGADO';

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicComments() {
    return this.prisma.comment.findMany({
      where: {
        status: 'APROBADO',
        visible: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async createPublicComment(data: CreateCommentDto) {
    return this.prisma.comment.create({
      data: {
        author: data.author.trim(),
        text: data.text.trim(),
        status: 'PENDIENTE',
        visible: false,
      },
    });
  }

  async getAdminComments(status?: CommentStatus) {
    return this.prisma.comment.findMany({
      where: status ? { status } : {},
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async approveComment(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: 'APROBADO',
        visible: true,
      },
    });
  }

  async denyComment(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
    });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    return this.prisma.comment.update({
      where: { id },
      data: {
        status: 'DENEGADO',
        visible: false,
      },
    });
  }

  async getPendingCount() {
    const count = await this.prisma.comment.count({
      where: {
        status: 'PENDIENTE',
      },
    });

    return { count };
  }
}
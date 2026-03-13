import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentStatus = 'PENDIENTE' | 'APROBADO' | 'DENEGADO';

type AdminCommentsParams = {
  status?: CommentStatus;
  search?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
};

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

  async getAdminComments(params: AdminCommentsParams) {
    const {
      status,
      search = '',
      from,
      to,
      page = 1,
      limit = 10,
    } = params;

    const safePage = Math.max(1, Number(page) || 1);
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.CommentWhereInput = {};

    if (status) {
      where.status = status;
    }

    const searchTrimmed = search.trim();
    if (searchTrimmed) {
      where.OR = [
        {
          author: {
            contains: searchTrimmed,
            mode: 'insensitive',
          },
        },
        {
          text: {
            contains: searchTrimmed,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (from || to) {
      where.createdAt = {};
      if (from) {
        where.createdAt.gte = new Date(`${from}T00:00:00.000Z`);
      }
      if (to) {
        where.createdAt.lte = new Date(`${to}T23:59:59.999Z`);
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: safeLimit,
      }),
      this.prisma.comment.count({ where }),
    ]);

    return {
      items,
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages: Math.max(1, Math.ceil(total / safeLimit)),
      },
    };
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
  
  async deleteComment(id: string) {
  const comment = await this.prisma.comment.findUnique({
    where: { id },
  });

    if (!comment) {
      throw new NotFoundException('Comentario no encontrado');
    }

    return this.prisma.comment.delete({
      where: { id },
    });
  }
}
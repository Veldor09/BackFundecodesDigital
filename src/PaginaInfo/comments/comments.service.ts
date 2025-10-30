import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@Injectable()
export class CommentsService {
  constructor(private prisma: PrismaService) {}

  // ✅ Listar comentarios visibles (público)
  async findAll() {
    return this.prisma.comment.findMany({
      where: { visible: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Crear nuevo comentario
  async create(data: CreateCommentDto) {
    const saved = await this.prisma.comment.create({ data });
    return saved;
  }
}

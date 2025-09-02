import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Injectable()
export class NewsService {
  constructor(private readonly prisma: PrismaService) {}

  list(published?: boolean) {
    return this.prisma.news.findMany({
      where: published === undefined ? {} : { published },
      orderBy: { updatedAt: 'desc' },
    });
  }

  getBySlug(slug: string) {
    return this.prisma.news.findUnique({ where: { slug } });
  }

  create(data: CreateNewsDto) {
    return this.prisma.news.create({ data });
  }

  // ⬇️ Cambios clave: id: number en firma y en where
  update(id: number, data: Partial<CreateNewsDto>) {
    return this.prisma.news.update({ where: { id: Number(id) }, data });
  }

  // ⬇️ Cambios clave: id: number en firma y en where
  async remove(id: number) {
    await this.prisma.news.findUniqueOrThrow({ where: { id: Number(id) } });
    await this.prisma.news.delete({ where: { id: Number(id) } });
    return { ok: true };
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNewsDto } from './dto/create-news.dto';

@Injectable()
export class NewsService {
  constructor(private prisma: PrismaService) {}

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

  update(id: string, data: Partial<CreateNewsDto>) {
    return this.prisma.news.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.news.delete({ where: { id } });
  }
}

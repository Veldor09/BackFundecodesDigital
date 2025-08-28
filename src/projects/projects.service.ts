import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  list(published?: boolean) {
    return this.prisma.project.findMany({
      where: published === undefined ? {} : { published },
      orderBy: { updatedAt: 'desc' },
    });
  }

  getBySlug(slug: string) {
    return this.prisma.project.findUnique({ where: { slug } });
  }

  create(data: CreateProjectDto) {
    return this.prisma.project.create({ data });
  }

  update(id: string, data: UpdateProjectDto) {
    return this.prisma.project.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.project.delete({ where: { id } });
  }
}

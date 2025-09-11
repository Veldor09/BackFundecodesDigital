import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { InformationalPageDto } from './dto/informational-page.dto';

@Injectable()
export class InformationalPageService {
  constructor(private prisma: PrismaService) {}

  async get(): Promise<InformationalPageDto> {
    const record = await this.prisma.informationalPage.findUnique({
      where: { id: 'default' },
    });

    if (!record) {
      return this.createDefault();
    }

    return {
      vision: record.vision as any,
      mission: record.mission as any,
      collaborators: record.collaborators as any,
      comments: record.comments as any,
    };
  }

  async update(data: InformationalPageDto): Promise<InformationalPageDto> {
    await this.prisma.informationalPage.upsert({
      where: { id: 'default' },
      update: {
        vision: data.vision as any,
        mission: data.mission as any,
        collaborators: data.collaborators as any,
        comments: data.comments as any,
      },
      create: {
        id: 'default',
        vision: data.vision as any,
        mission: data.mission as any,
        collaborators: data.collaborators as any,
        comments: data.comments as any,
      },
    });

    return data;
  }

  private async createDefault(): Promise<InformationalPageDto> {
    const defaultData: InformationalPageDto = {
      vision: {
        title: "VISIÓN",
        content: "Nos esforzamos por impulsar comunidades costeras prósperas...",
        imageUrl: "/Imagenes/Vision.jpg",
      },
      mission: {
        title: "MISIÓN",
        content: "Trabajamos de manera colaborativa con comunidades costeras...",
        imageUrl: "/Imagenes/Mision.jpg",
      },
      collaborators: [],
      comments: [],
    };

    await this.prisma.informationalPage.create({
      data: {
        id: 'default',
        vision: defaultData.vision as any,
        mission: defaultData.mission as any,
        collaborators: defaultData.collaborators as any,
        comments: defaultData.comments as any,
      },
    });

    return defaultData;
  }
}
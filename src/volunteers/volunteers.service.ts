import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVolunteerDto } from './dto/create-volunteer.dto';

@Injectable()
export class VolunteersService {
  constructor(private prisma: PrismaService) {}

  async create(createVolunteerDto: CreateVolunteerDto) {
    return this.prisma.volunteer.create({
      data: createVolunteerDto,
    });
  }
}
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateVolunteerFormDto } from './dto/create-volunteer-form.dto';

@Injectable()
export class VolunteersFormService {
  constructor(private prisma: PrismaService) {}

  async create(createVolunteerFormDto: CreateVolunteerFormDto) {
    return this.prisma.volunteerForm.create({
      data: createVolunteerFormDto,
    });
  }
}

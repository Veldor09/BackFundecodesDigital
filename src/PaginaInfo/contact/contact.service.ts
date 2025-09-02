import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateContactDto } from './dto/create-contact.dto';

@Injectable()
export class ContactService {
  constructor(private prisma: PrismaService) {}
  create(dto: CreateContactDto) {
    return this.prisma.contactMessage.create({ data: dto });
  }
}

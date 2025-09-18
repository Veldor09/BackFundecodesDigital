import { Module } from '@nestjs/common';
import { VolunteersFormService } from './volunteer-form.service';
import { VolunteersFormController } from './volunteer-form.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [VolunteersFormController],
  providers: [VolunteersFormService, PrismaService],
})
export class VolunteersFormModule {}

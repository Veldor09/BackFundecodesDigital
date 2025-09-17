import { Module } from '@nestjs/common';
import { VolunteersService } from './volunteers.service';
import { VolunteersController } from './volunteers.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [VolunteersController],
  providers: [VolunteersService, PrismaService],
})
export class VolunteersModule {}

import { Module } from '@nestjs/common';
import { VisitacionesService } from './visitaciones.service';
import { VisitacionesController } from './visitaciones.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [VisitacionesController],
  providers: [VisitacionesService, PrismaService],
})
export class VisitacionesModule {}

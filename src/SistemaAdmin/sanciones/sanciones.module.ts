import { Module } from '@nestjs/common';
import { SancionesService } from './sanciones.service';
import { SancionesController } from './sanciones.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [SancionesController],
  providers: [SancionesService, PrismaService],
})
export class SancionesModule {}

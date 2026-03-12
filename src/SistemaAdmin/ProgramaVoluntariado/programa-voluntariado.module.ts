import { Module } from '@nestjs/common';
import { ProgramaVoluntariadoController } from './programa-voluntariado.controller';
import { ProgramaVoluntariadoService } from './programa-voluntariado.service';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [ProgramaVoluntariadoController],
  providers: [ProgramaVoluntariadoService, PrismaService],
  exports: [ProgramaVoluntariadoService],
})
export class ProgramaVoluntariadoModule {}
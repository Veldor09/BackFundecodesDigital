import { Module } from '@nestjs/common';
import { RespuestasFormularioController } from './respuestas-formulario.controller';
import { RespuestasFormularioService } from './respuestas-formulario.service';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [RespuestasFormularioController],
  providers: [RespuestasFormularioService, PrismaService],
  exports: [RespuestasFormularioService],
})
export class RespuestasFormularioModule {}
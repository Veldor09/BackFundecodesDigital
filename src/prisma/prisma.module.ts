// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global() // 👉 hace que el servicio esté disponible en toda la app
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}

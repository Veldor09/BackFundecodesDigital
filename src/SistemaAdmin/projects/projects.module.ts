// src/SistemaAdmin/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule], // con @Global() en PrismaModule podrías omitirlo
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService], // 👉 útil si otro módulo necesita inyectar ProjectsService
})
export class ProjectsModule {}

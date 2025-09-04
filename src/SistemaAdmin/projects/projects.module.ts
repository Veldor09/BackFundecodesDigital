// src/SistemaAdmin/projects/projects.module.ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [PrismaModule],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  // si en algún momento necesitas usar el service desde otro módulo:
  exports: [ProjectsService],
})
export class ProjectsModule {}

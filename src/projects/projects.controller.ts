import { Controller, Get, Param, Query, Post, Body, Patch, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  @Get()
  list(@Query('published') published?: string) {
    const p = published === undefined ? undefined : published === 'true';
    return this.service.list(p);
  }

  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

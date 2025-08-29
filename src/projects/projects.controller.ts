import { Controller, Get, Param, Query, Post, Body, Patch, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { ListProjectsQuery } from './dto/list-projects.query';

@ApiTags('projects')
@Controller('projects')
export class ProjectsController {
  constructor(private readonly service: ProjectsService) {}

  // GET /projects?q=&category=&status=&place=&area=&page=&pageSize=&published=
  @Get()
  list(@Query() query: ListProjectsQuery) {
    return this.service.list(query);
  }

  // GET /projects/:slug
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  // POST /projects
  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.service.create(dto);
  }

  // PATCH /projects/:id
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.service.update(id, dto);
  }

  // DELETE /projects/:id
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

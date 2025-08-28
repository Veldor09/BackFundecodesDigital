import { Controller, Get, Param, Query, Post, Body, Patch, Delete } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly service: NewsService) {}

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
  create(@Body() dto: CreateNewsDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: Partial<CreateNewsDto>) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}

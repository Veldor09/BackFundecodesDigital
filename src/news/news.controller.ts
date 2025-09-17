import {
  Controller,
  Get,
  Param,
  Post,
  Body,
  Patch,
  Delete,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { NewsService } from './news.service';
import { CreateNewsDto } from './dto/create-news.dto';
// Si no tienes UpdateNewsDto, puedes usar Partial<CreateNewsDto>

@ApiTags('news')
@Controller('news')
export class NewsController {
  constructor(private readonly service: NewsService) {}

  // Lista (opcional: filtrar por published)
  @Get()
  list(@Query('published') published?: string) {
    const p = published === undefined ? undefined : published === 'true';
    return this.service.list(p);
  }

  // Detalle por slug
  @Get(':slug')
  get(@Param('slug') slug: string) {
    return this.service.getBySlug(slug);
  }

  // Crear
  @Post()
  create(@Body() dto: CreateNewsDto) {
    return this.service.create(dto);
  }

  // Actualizar -> id numérico
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<CreateNewsDto>,
  ) {
    return this.service.update(id, dto);
  }

  // Eliminar -> id numérico
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}

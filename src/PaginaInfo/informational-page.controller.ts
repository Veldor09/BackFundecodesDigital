
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { InformationalPageService } from './informational-page.service';
import { InformationalPageDto } from './dto/informational-page.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('informational-page')
export class InformationalPageController {
  constructor(private readonly service: InformationalPageService) {}

  @Get()
  async getPublic() {
    return this.service.get();
  }

  @Put()
  @UseGuards(JwtAuthGuard) // Protegido para admin
  async update(@Body() data: InformationalPageDto) {
    return this.service.update(data);
  }
}
// src/PaginaInfo/informational-page.controller.ts
import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { InformationalPageService } from './informational-page.service';
import { InformationalPageDto } from './dto/informational-page.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Public } from '../common/decorators/public.decorator'; // ✅ nuevo import

@Controller('informational-page')
export class InformationalPageController {
  constructor(private readonly service: InformationalPageService) {}

  // ✅ Ruta pública para el landing (no requiere token)
  @Public()
  @Get()
  async getPublic() {
    return this.service.get();
  }

  // 🔒 Ruta protegida para panel admin
  @UseGuards(JwtAuthGuard)
  @Put()
  async update(@Body() data: InformationalPageDto) {
    return this.service.update(data);
  }
}

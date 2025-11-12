import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // GET /
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // GET /health  ← la que usará Render para el health check
  @Get('health')
  health() {
    return {
      ok: true,
      service: 'BackFundecodesDigital',
      uptime: process.uptime(),
      ts: new Date().toISOString(),
    };
  }
}

// src/app.controller.ts
import { Controller, Get, Head } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // Nota: por el prefijo global, este endpoint vive en /api
  @Get()
  getRoot() {
    return { ok: true, name: 'BackFundecodesDigital', docs: '/docs', api: '/api' };
  }

  @Head()
  headRoot() {
    // 200 vacío
  }

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

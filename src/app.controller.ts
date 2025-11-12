// src/app.controller.ts
import { Controller, Get, Head } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getRoot() {
    return { ok: true, name: 'BackFundecodesDigital', docs: '/docs', api: '/api' };
  }

  @Head()
  headRoot() {
    // Responde 200 vacío para HEAD /
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

// src/app.controller.ts
import { Controller, Get, Head, Redirect } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // "/" SIN prefijo (gracias al exclude del globalPrefix)
  @Get()
  @Redirect('/docs', 302) // opcional: redirige a Swagger
  getRoot() {
    // Si no quieres redirigir, comenta @Redirect y retorna el JSON:
    // return { ok: true, name: 'BackFundecodesDigital', docs: '/docs', api: '/api' };
  }

  @Head()
  headRoot() {
    // 200 vacío para HEAD /
    return;
  }

  // Health bajo prefijo global ⇒ /api/health
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

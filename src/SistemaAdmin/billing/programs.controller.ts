// src/SistemaAdmin/billing/programs.controller.ts
import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';

// ⬇️ Guards y permisos (ajusta rutas si fuera necesario)
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Billing - Programs')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('facturas:access')
@Controller('programs')
export class ProgramsController {
  constructor(private svc: BillingService) {}

  @Get()
  list() {
    return this.svc.listPrograms();
  }
}

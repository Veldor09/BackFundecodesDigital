import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { BillingService } from './billing.service';

@ApiTags('Billing - Programs')
@Controller('programs')
export class ProgramsController {
  constructor(private svc: BillingService) {}
  @Get()
  list() { return this.svc.listPrograms(); }
}

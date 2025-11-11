import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';

import { TokenService } from './services/token.service';
import { EmailService } from './services/email.service';
import { WelcomeFlowService } from './services/welcome-flow.service';
import { AuditService } from './services/audit.service';
import { StorageService } from './services/storage.service';

const COMMON_SERVICES = [
  TokenService,
  EmailService,
  WelcomeFlowService,
  AuditService,
  StorageService,
];

@Module({
  imports: [PrismaModule],
  providers: [...COMMON_SERVICES],
  exports: [...COMMON_SERVICES],
})
export class CommonModule {}

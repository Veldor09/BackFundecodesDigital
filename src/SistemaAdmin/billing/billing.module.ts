import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramsController } from './programs.controller';
import { RequestsController } from './requests.controller';
import { BillingService } from './billing.service';
import { AccountingController } from './accounting.controller';

@Module({
  imports: [
    MulterModule.register({
      dest: process.env.BILLING_UPLOADS_DIR || 'uploads/billing',
    }),
  ],
  controllers: [ProgramsController, RequestsController, AccountingController],
  providers: [BillingService, PrismaService],
})
export class BillingModule {}

import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PrismaService } from '../../prisma/prisma.service';
import { ProgramsController } from './programs.controller';
import { RequestsController } from './requests.controller';
import { BillingService } from './billing.service';
import { AccountingController } from './accounting.controller';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    // Memory storage: el buffer llega al servicio y se sube a R2
    MulterModule.register({ storage: memoryStorage() }),
    StorageModule,
  ],
  controllers: [ProgramsController, RequestsController, AccountingController],
  providers: [BillingService, PrismaService],
})
export class BillingModule {}

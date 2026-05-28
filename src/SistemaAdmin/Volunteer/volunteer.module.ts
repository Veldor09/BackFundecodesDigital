import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { VolunteerService } from './volunteer.service';
import { VolunteerController } from './volunteer.controller';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    ScheduleModule.forRoot(), // habilita los decoradores @Cron
  ],
  controllers: [VolunteerController],
  providers: [VolunteerService],
  exports: [VolunteerService],
})
export class VolunteerModule {}

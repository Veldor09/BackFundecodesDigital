import { Module } from '@nestjs/common';
import { AreasController } from './areas.controller';
import { AreasService } from './areas.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../../auth/auth.module';

@Module({
  imports: [PrismaModule, CommonModule, AuthModule],
  controllers: [AreasController],
  providers: [AreasService],
  exports: [AreasService],
})
export class AreasModule {}

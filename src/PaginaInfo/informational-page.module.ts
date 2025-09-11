import { Module } from '@nestjs/common';
import { InformationalPageController } from './informational-page.controller';
import { InformationalPageService } from './informational-page.service';

@Module({
  controllers: [InformationalPageController],
  providers: [InformationalPageService],
})
export class InformationalPageModule {}
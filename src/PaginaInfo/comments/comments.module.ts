import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageModule } from '../../common/storage/storage.module';

@Module({
  imports: [
    StorageModule,
    MulterModule.register({ storage: memoryStorage() }),
  ],
  controllers: [CommentsController],
  providers: [CommentsService, PrismaService],
})
export class CommentsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { NewsModule } from './news/news.module';
import { ContactModule } from './contact/contact.module';
import { VolunteersModule } from './volunteers/volunteers.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    ProjectsModule,
    NewsModule,
    ContactModule,
    VolunteersModule,
  ],
})
export class AppModule {}

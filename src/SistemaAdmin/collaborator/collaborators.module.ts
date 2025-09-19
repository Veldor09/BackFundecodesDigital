// src/SistemaAdmin/collaborator/collaborators.module.ts
import { Module } from '@nestjs/common';
import { CollaboratorsController } from './collaborators.controller';
import { CollaboratorsService } from './collaborators.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { CommonModule } from '../../common/common.module';
import { AuthModule } from '../../auth/auth.module'; // 👈 trae JwtService (JwtModule exportado)

@Module({
  imports: [
    PrismaModule,
    CommonModule, 
    AuthModule,   
  ],
  controllers: [CollaboratorsController],
  providers: [CollaboratorsService],
  exports: [CollaboratorsService],
})
export class CollaboratorsModule {}

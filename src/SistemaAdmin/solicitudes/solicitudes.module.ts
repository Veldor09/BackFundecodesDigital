// src/SistemaAdmin/solicitudes/solicitudes.module.ts
import { Module } from '@nestjs/common';
import { SolicitudesService } from './solicitudes.service';
import { SolicitudesController } from './solicitudes.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EmailService } from '../../common/services/email.service'; // ← agregado

@Module({
  imports: [PrismaModule],
  controllers: [SolicitudesController],
  providers: [SolicitudesService, EmailService], // ← EmailService agregado
})
export class SolicitudesModule {}
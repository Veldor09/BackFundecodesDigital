import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiQuery, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
  import { diskStorage } from 'multer';
import type { Request as ExRequest } from 'express';
import { extname } from 'path';
import { BillingService } from './billing.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';

function fname(
  req: ExRequest,
  file: Express.Multer.File,
  cb: (e: Error | null, name: string) => void,
) {
  const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(
    file.originalname,
  )}`;
  cb(null, safe);
}

@ApiTags('Billing - Accounting')
@Controller('billing')
export class AccountingController {
  constructor(private svc: BillingService) {}

  /* ----- Asignaciones de fondos ----- */
  @Post('allocations')
  createAllocation(@Body() dto: CreateAllocationDto) {
    return this.svc.createAllocation(dto);
  }

  /* ----- Pagos ----- */
  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.svc.createPayment(dto as any);
  }

  // NUEVO: listar pagos por requestId o projectId
  @Get('payments')
  @ApiQuery({ name: 'requestId', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  listPayments(
    @Query('requestId') requestId?: string,
    @Query('projectId') projectId?: string,
  ) {
    const hasRequest = requestId !== undefined && requestId !== null && requestId !== '';
    const hasProject = projectId !== undefined && projectId !== null && projectId !== '';

    if (!hasRequest && !hasProject) {
      throw new BadRequestException('Debe enviar requestId o projectId');
    }

    const reqIdNum = hasRequest ? Number(requestId) : undefined;
    const projIdNum = hasProject ? Number(projectId) : undefined;

    if (hasRequest && (!Number.isFinite(reqIdNum!) || reqIdNum! <= 0)) {
      throw new BadRequestException('requestId inválido');
    }
    if (hasProject && (!Number.isFinite(projIdNum!) || projIdNum! <= 0)) {
      throw new BadRequestException('projectId inválido');
    }

    return this.svc.listPayments({
      requestId: reqIdNum,
      projectId: projIdNum,
    });
  }

  /* ----- Recibos (archivo) ----- */
  @Post('receipts')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.BILLING_UPLOADS_DIR || 'uploads/billing',
        filename: fname,
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ok = [
          'application/pdf',
          'image/jpeg',
          'image/png',
          'image/webp',
        ].includes(file.mimetype);
        cb(ok ? null : new BadRequestException('Tipo no permitido'), ok);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        projectId: { type: 'integer' },
        paymentId: { type: 'string', nullable: true },
        file: { type: 'string', format: 'binary' },
      },
      required: ['projectId', 'file'],
    },
  })
  uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @Body('paymentId') paymentId?: string,
  ) {
    return this.svc.createReceipt({
      projectId: Number(projectId),
      paymentId,
      file,
    });
  }

  /* ----- Historial consolidado ----- */
  @Get('programs/:projectId/ledger')
  @ApiQuery({ name: 'projectId', required: true })
  getLedger(@Param('projectId') projectId: string) {
    return this.svc.getProgramLedger(Number(projectId));
  }
}

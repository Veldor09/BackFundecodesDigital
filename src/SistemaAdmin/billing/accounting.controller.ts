import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { BillingService } from './billing.service';
import { CreateAllocationDto } from './dto/create-allocation.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

@ApiTags('Billing - Accounting')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('facturas:access')
@Controller('billing')
export class AccountingController {
  constructor(private svc: BillingService) {}

  /* ----- Asignaciones de fondos ----- */
  @Post('allocations')
  @ApiOperation({ summary: 'Crear asignación de fondos' })
  createAllocation(@Body() dto: CreateAllocationDto) {
    return this.svc.createAllocation(dto);
  }

  /* ----- Pagos ----- */
  @Post('payments')
  @ApiOperation({ summary: 'Registrar pago de una solicitud' })
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.svc.createPayment(dto as any);
  }

  @Get('payments')
  @ApiOperation({ summary: 'Listar pagos por solicitud o proyecto' })
  @ApiQuery({ name: 'requestId', required: false, type: Number })
  @ApiQuery({ name: 'projectId', required: false, type: Number })
  listPayments(
    @Query('requestId') requestId?: string,
    @Query('projectId') projectId?: string,
  ) {
    const hasRequest = requestId !== undefined && requestId !== '';
    const hasProject = projectId !== undefined && projectId !== '';

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

    return this.svc.listPayments({ requestId: reqIdNum, projectId: projIdNum });
  }

  /* ----- Comprobante de Pago (R2) ----- */
  @Post('payments/:paymentId/comprobante')
  @ApiOperation({ summary: 'Adjuntar comprobante de pago (PDF o imagen) — subido a R2' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF o imagen del comprobante' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadComprobante(
    @Param('paymentId') paymentId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.svc.uploadComprobante(paymentId, file);
  }

  @Delete('payments/:paymentId/comprobante')
  @ApiOperation({ summary: 'Eliminar comprobante de pago' })
  deleteComprobante(@Param('paymentId') paymentId: string) {
    return this.svc.deleteComprobante(paymentId);
  }

  /* ----- Recibos de factura (R2) ----- */
  @Post('receipts')
  @ApiOperation({ summary: 'Adjuntar recibo de factura a un proyecto (subido a R2)' })
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
  @UseInterceptors(FileInterceptor('file'))
  uploadReceipt(
    @UploadedFile() file: Express.Multer.File,
    @Body('projectId') projectId: string,
    @Body('paymentId') paymentId?: string,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido (file)');
    return this.svc.createReceipt({ projectId: Number(projectId), paymentId, file });
  }

  /* ----- Historial consolidado ----- */
  @Get('programs/:projectId/ledger')
  @ApiOperation({ summary: 'Historial contable de un proyecto/programa' })
  getLedger(@Param('projectId') projectId: string) {
    return this.svc.getProgramLedger(Number(projectId));
  }

  /* ----- Crear BillingRequest desde una Solicitud aprobada ----- */
  @Post('request-from-solicitud/:solicitudId')
  @ApiOperation({ summary: 'Crear BillingRequest desde solicitud aprobada' })
  createBillingRequestFromSolicitud(
    @Param('solicitudId', ParseIntPipe) solicitudId: number,
  ) {
    return this.svc.createBillingRequestFromSolicitud(solicitudId);
  }
}

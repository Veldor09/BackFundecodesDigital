// src/SistemaAdmin/requests/requests.controller.ts (ajusta la ruta real)
import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import type { Request as ExRequest } from 'express';
import { extname } from 'path';

import { BillingService } from './billing.service';
import { CreateBillingRequestDto } from './dto/create-request.dto';
import { PatchBillingRequestDto } from './dto/patch-request.dto';
import { FinalInvoiceBodyDto } from './dto/final-invoice.dto';

import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { PermissionsGuard } from '../../common/guards/permissions.guard';
import { Permissions } from '../../common/decorators/permissions.decorator';

function filenameCb(
  req: ExRequest,
  file: Express.Multer.File,
  cb: (err: Error | null, filename: string) => void,
) {
  const safe = `${Date.now()}-${Math.round(Math.random() * 1e9)}${extname(file.originalname)}`;
  cb(null, safe);
}

@ApiTags('Billing - Requests')
@ApiBearerAuth('bearer')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('facturas:access')
@Controller('requests')
export class RequestsController {
  constructor(private svc: BillingService) {}

  @Get()
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'Filtrar por estado',
    enum: ['PENDING', 'VALIDATED', 'APPROVED', 'REJECTED', 'PAID'],
  })
  @ApiQuery({
    name: 'createdBy',
    required: false,
    description: 'Filtrar por creador (email o id, según tu servicio)',
  })
  list(@Query('status') status?: string, @Query('createdBy') createdBy?: string) {
    return this.svc.listRequests({ status: status as any, createdBy });
  }

  @Get(':id')
  @ApiParam({ name: 'id', type: Number, required: true })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.svc.getRequest(id);
  }

  @Post()
  create(@Body() dto: CreateBillingRequestDto) {
    return this.svc.createRequest(dto);
  }

  // PATCH genérico (soporta body.finalInvoice como en tu billing.api.ts)
  @Patch(':id')
  @ApiParam({ name: 'id', type: Number, required: true })
  patch(@Param('id', ParseIntPipe) id: number, @Body() dto: PatchBillingRequestDto) {
    return this.svc.patchRequest(id, dto as any);
  }

  // Endpoint explícito para factura final con archivo (opcional)
  @Post(':id/final-invoice')
  @ApiParam({ name: 'id', type: Number, required: true })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: process.env.BILLING_UPLOADS_DIR || 'uploads/billing',
        filename: filenameCb,
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const ok = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(
          file.mimetype,
        );
        cb(ok ? null : new BadRequestException('Tipo no permitido'), ok);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        number: { type: 'string' },
        date: { type: 'string', format: 'date' },
        total: { type: 'number' },
        currency: { type: 'string', enum: ['CRC', 'USD', 'EUR'] },
        file: { type: 'string', format: 'binary' },
      },
      required: ['number', 'date', 'total', 'currency'],
    },
  })
  async uploadFinalInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: FinalInvoiceBodyDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const req = await this.svc.getRequest(id);
    return this.svc.upsertFinalInvoiceFromJson(req, {
      ...body,
      file,
      currency: body.currency as any,
    });
  }
}

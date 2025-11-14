import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Currency, BillingRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  /* ====================== Programs ====================== */
  async listPrograms() {
    const rows = await this.prisma.project.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
    return rows.map((r) => ({ id: String(r.id), name: r.title }));
  }

  /* ====================== Requests ====================== */
  async createRequest(dto: {
    amount: number;
    concept: string;
    projectId: number;
    draftInvoiceUrl?: string;
    createdBy?: string;
    history?: any[];
  }) {
    return this.prisma.billingRequest.create({
      data: {
        amount: new Prisma.Decimal(dto.amount),
        concept: dto.concept.trim(),
        projectId: dto.projectId,
        draftInvoiceUrl: dto.draftInvoiceUrl,
        createdBy: dto.createdBy,
        status: 'PENDING',
        history: dto.history ?? [],
      },
    });
  }

  async listRequests(filter?: { status?: BillingRequestStatus; createdBy?: string }) {
    return this.prisma.billingRequest.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.createdBy ? { createdBy: filter.createdBy } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(id: number) {
    const r = await this.prisma.billingRequest.findUnique({ where: { id } });
    if (!r) throw new NotFoundException('Request no encontrada');
    return r;
  }

  async patchRequest(id: number, body: any) {
    const req = await this.getRequest(id);

    // Si viene finalInvoice en el patch (compat con tu front actual)
    if (body?.finalInvoice) {
      const fi = body.finalInvoice;
      return await this.upsertFinalInvoiceFromJson(req, {
        number: fi.number,
        date: fi.date,
        total: Number(fi.total),
        currency: fi.currency,
        file: undefined, // sin archivo en esta ruta
      });
    }

    // patch normal (estado, comentarios, history…)
    return this.prisma.billingRequest.update({
      where: { id },
      data: {
        draftInvoiceUrl: body?.draftInvoiceUrl,
        status: body?.status as any,
        history: body?.history ?? req.history,
        // opcionalmente almacenar notas
        createdBy: body?.createdBy ?? req.createdBy,
      },
    });
  }

  /* ============== Final Invoice (con validación) ============== */
  private assertInvoiceAgainstRequest(params: {
    req: { concept: string; amount: Prisma.Decimal };
    invoice: { total: number; concept?: string };
  }) {
    const conceptOk =
      !params.invoice.concept ||
      params.req.concept.trim().toLowerCase() ===
        params.invoice.concept.trim().toLowerCase();
    if (!conceptOk)
      throw new ForbiddenException(
        'El concepto de la factura no coincide con la solicitud',
      );

    const requested = Number(params.req.amount);
    if (Number(params.invoice.total) !== requested) {
      // si prefieres permitir >=, cambia esta validación
      throw new ForbiddenException(
        `El total de la factura (${params.invoice.total}) debe coincidir con el monto solicitado (${requested})`,
      );
    }
  }

  async upsertFinalInvoiceFromJson(
    req: { id: number; projectId: number; concept: string; amount: Prisma.Decimal },
    input: {
      number: string;
      date: string;
      total: number;
      currency: Currency;
      file?: Express.Multer.File | undefined;
      conceptOverride?: string;
    },
  ) {
    this.assertInvoiceAgainstRequest({
      req,
      invoice: {
        total: input.total,
        concept: input.conceptOverride ?? req.concept,
      },
    });

    const base = {
      projectId: req.projectId,
      number: input.number,
      date: new Date(input.date),
      total: new Prisma.Decimal(input.total),
      currency: input.currency,
      isValid: true,
    } as const;

    const f = input.file;
    const fileData = f
      ? {
          url: `/uploads/billing/${f.filename}`,
          mime: f.mimetype,
          bytes: f.size,
        }
      : {};

    // requestId es UNIQUE en BillingInvoice => upsert limpio
    const invoice = await this.prisma.billingInvoice.upsert({
      where: { requestId: req.id },
      update: { ...base, ...fileData },
      create: { requestId: req.id, ...base, ...fileData },
    });

    return invoice;
  }

  /* ====================== Allocations ====================== */
  async createAllocation(dto: {
    projectId: number;
    concept: string;
    amount: number;
    date?: string;
  }) {
    // fondos disponibles = sum(Presupuesto.montoAsignado) - sum(ProgramAllocation.amount)
    const [pres, alloc] = await Promise.all([
      this.prisma.presupuesto.aggregate({
        where: { projectId: dto.projectId },
        _sum: { montoAsignado: true },
      }),
      this.prisma.programAllocation.aggregate({
        where: { projectId: dto.projectId },
        _sum: { amount: true },
      }),
    ]);
    const asignado = Number(pres._sum.montoAsignado ?? 0);
    const yaAsignado = Number(alloc._sum.amount ?? 0);
    const disponible = asignado - yaAsignado;

    if (dto.amount > disponible) {
      throw new BadRequestException(
        `Fondos insuficientes. Disponible: ${disponible.toLocaleString()}`,
      );
    }

    return this.prisma.programAllocation.create({
      data: {
        projectId: dto.projectId,
        concept: dto.concept.trim(),
        amount: new Prisma.Decimal(dto.amount),
        date: dto.date ? new Date(dto.date) : undefined,
      },
    });
  }

  /* ====================== Payments ====================== */
  async createPayment(dto: {
    requestId: number;
    projectId: number;
    date: string;
    amount: number;
    reference: string;
    currency: Currency;
  }) {
    // 1) Intentamos cargar el BillingRequest por id
    let req = await this.prisma.billingRequest.findUnique({
      where: { id: Number(dto.requestId) },
    });

    // 2) Si no existe, lo provisionamos "en caliente" usando el MISMO id
    //    para mantener la correlación con la Solicitud (front).
    if (!req) {
      const concept =
        `Auto: pago ${dto.reference?.trim() || ''}`.substring(0, 255) || 'Auto: pago';
      const amount = new Prisma.Decimal(dto.amount ?? 0);

      // IMPORTANTE: insertamos con el id explícito = dto.requestId
      req = await this.prisma.billingRequest.create({
        data: {
          id: Number(dto.requestId), // <-- clave para evitar el 404 y mantener el id
          projectId: Number(dto.projectId),
          concept,
          amount,
          status: 'APPROVED', // o el que encaje mejor con tu flujo
          history: [{ autoProvisioned: true, at: new Date().toISOString() }] as any,
        },
      });
    }

    // 3) Verificación de proyecto coherente
    if (Number(req.projectId) !== Number(dto.projectId)) {
      throw new BadRequestException(
        'El pago no corresponde al mismo proyecto del request',
      );
    }

    // 4) Crear el pago
    const payment = await this.prisma.payment.create({
      data: {
        requestId: req.id, // usar el id REAL del billingRequest
        projectId: req.projectId,
        amount: new Prisma.Decimal(dto.amount),
        currency: dto.currency,
        reference: dto.reference.trim(),
        date: new Date(dto.date),
      },
    });

    // 5) Marcar la solicitud de billing como pagada
    await this.prisma.billingRequest.update({
      where: { id: req.id },
      data: { status: 'PAID' },
    });

    return payment;
  }

  // NUEVO: listar pagos por requestId o projectId
  async listPayments(params: { requestId?: number; projectId?: number }) {
    const { requestId, projectId } = params;
    if (!requestId && !projectId) {
      throw new BadRequestException('Debe enviar requestId o projectId');
    }
    if (requestId && (!Number.isFinite(requestId) || requestId <= 0)) {
      throw new BadRequestException('requestId inválido');
    }
    if (projectId && (!Number.isFinite(projectId) || projectId <= 0)) {
      throw new BadRequestException('projectId inválido');
    }

    return this.prisma.payment.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(projectId ? { projectId } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  /* ====================== Receipts ====================== */
  async createReceipt(params: {
    projectId: number;
    paymentId?: string;
    file: Express.Multer.File;
  }) {
    const f = params.file;
    if (!f) throw new BadRequestException('Archivo requerido');

    return this.prisma.receipt.create({
      data: {
        projectId: params.projectId,
        paymentId: params.paymentId,
        url: `/uploads/billing/${f.filename}`,
        mime: f.mimetype,
        bytes: f.size,
        filename: f.originalname,
      },
    });
  }

  /* ====================== Ledger ====================== */
  async getProgramLedger(projectId: number) {
    const [budgets, allocations, invoices, payments, receipts] = await Promise.all([
      this.prisma.presupuesto.findMany({ where: { projectId } }),
      this.prisma.programAllocation.findMany({ where: { projectId } }),
      this.prisma.billingInvoice.findMany({ where: { projectId } }),
      this.prisma.payment.findMany({ where: { projectId } }),
      this.prisma.receipt.findMany({ where: { projectId } }),
    ]);

    const rows = [
      ...budgets.map((b) => ({
        type: 'BUDGET',
        date: new Date(b.anio, (b.mes ?? 1) - 1, 1),
        amount: Number(b.montoAsignado),
        meta: { mes: b.mes, anio: b.anio },
      })),
      ...allocations.map((a) => ({
        type: 'ALLOCATION',
        date: a.date,
        amount: -Number(a.amount),
        meta: { concept: a.concept },
      })),
      ...invoices.map((i) => ({
        type: 'INVOICE',
        date: i.date,
        amount: -Number(i.total),
        meta: { number: i.number, currency: i.currency, valid: i.isValid },
      })),
      ...payments.map((p) => ({
        type: 'PAYMENT',
        date: p.date,
        amount: -Number(p.amount),
        meta: { reference: p.reference, currency: p.currency },
      })),
      ...receipts.map((r) => ({
        type: 'RECEIPT',
        date: r.uploadedAt,
        amount: 0,
        meta: {
          url: r.url,
          mime: r.mime,
          filename: r.filename,
          paymentId: r.paymentId,
        },
      })),
    ];

    return rows.sort((a, b) => +new Date(a.date as any) - +new Date(b.date as any));
  }

  async createBillingRequestFromSolicitud(solicitudId: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id: solicitudId },
      include: { usuario: true },
    });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estadoDirector !== 'APROBADA')
      throw new ForbiddenException('La solicitud no está aprobada por dirección');

    // Evitar duplicados
    const existing = await this.prisma.billingRequest.findFirst({
      where: { concept: `Solicitud #${solicitud.id}` },
    });

    if (existing) return existing;

    // Crear uno nuevo
    return this.prisma.billingRequest.create({
      data: {
        amount: 0, // puedes calcularlo si tienes lógica de monto
        concept: `Solicitud #${solicitud.id}`,
        projectId: 1, // <-- puedes inferirlo desde usuario o lógica interna
        status: 'APPROVED',
        history: [{ fromSolicitud: true, at: new Date().toISOString() }],
      },
    });
  }
}

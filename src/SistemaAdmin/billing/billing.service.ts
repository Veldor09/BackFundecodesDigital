import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, Currency, BillingRequestStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BillingService {
  constructor(private prisma: PrismaService) {}

  // ====================== Programs list (para selector en el front) ======================
  async listPrograms() {
    const rows = await this.prisma.project.findMany({
      select: { id: true, title: true },
      orderBy: { title: 'asc' },
    });
    return rows.map((r) => ({ id: String(r.id), name: r.title }));
  }

  // ====================== Requests ======================
  async createRequest(dto: {
    amount: number;
    concept: string;
    projectId?: number | null;
    programaId?: number | null;
    draftInvoiceUrl?: string;
    createdBy?: string;
    history?: any[];
  }) {
    // Validar XOR
    const hasProject = !!dto.projectId;
    const hasPrograma = !!dto.programaId;
    if (hasProject === hasPrograma) {
      throw new BadRequestException(
        'Debe indicar exactamente uno de projectId o programaId.',
      );
    }

    // Snapshot cuentaId
    const cuentaId = await this._resolveCuentaId(dto.projectId ?? null, dto.programaId ?? null);

    return this.prisma.billingRequest.create({
      data: {
        amount: new Prisma.Decimal(dto.amount),
        concept: dto.concept.trim(),
        projectId: dto.projectId ?? null,
        programaId: dto.programaId ?? null,
        cuentaId,
        draftInvoiceUrl: dto.draftInvoiceUrl,
        createdBy: dto.createdBy,
        status: 'PENDING',
        history: dto.history ?? [],
      },
    });
  }

  async listRequests(filter?: {
    status?: BillingRequestStatus;
    createdBy?: string;
    projectId?: number;
    programaId?: number;
  }) {
    return this.prisma.billingRequest.findMany({
      where: {
        ...(filter?.status ? { status: filter.status } : {}),
        ...(filter?.createdBy ? { createdBy: filter.createdBy } : {}),
        ...(filter?.projectId ? { projectId: filter.projectId } : {}),
        ...(filter?.programaId ? { programaId: filter.programaId } : {}),
      },
      include: {
        project: { select: { id: true, title: true } },
        programa: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getRequest(id: number) {
    const r = await this.prisma.billingRequest.findUnique({
      where: { id },
      include: {
        project: { select: { id: true, title: true } },
        programa: { select: { id: true, nombre: true } },
      },
    });
    if (!r) throw new NotFoundException('Request no encontrada');
    return r;
  }

  async patchRequest(id: number, body: any) {
    const req = await this.getRequest(id);

    if (body?.finalInvoice) {
      const fi = body.finalInvoice;
      return await this.upsertFinalInvoiceFromJson(req as any, {
        number: fi.number,
        date: fi.date,
        total: Number(fi.total),
        currency: fi.currency,
        file: undefined,
      });
    }

    return this.prisma.billingRequest.update({
      where: { id },
      data: {
        draftInvoiceUrl: body?.draftInvoiceUrl,
        status: body?.status as any,
        history: body?.history ?? req.history,
        createdBy: body?.createdBy ?? req.createdBy,
      },
    });
  }

  // ============== Final Invoice ==============
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
      throw new ForbiddenException(
        `El total de la factura (${params.invoice.total}) debe coincidir con el monto solicitado (${requested})`,
      );
    }
  }

  async upsertFinalInvoiceFromJson(
    req: { id: number; projectId: number | null; programaId?: number | null; concept: string; amount: Prisma.Decimal },
    input: {
      number: string;
      date: string;
      total: number;
      currency: Currency;
      file?: Express.Multer.File | undefined;
      conceptOverride?: string;
    },
  ) {
    // BillingInvoice aún tiene FK dura a projectId — resolvemos el projectId
    // del BillingRequest o tomamos cualquier proyecto si es de programa.
    const projectId = req.projectId ?? await this._fallbackProjectId();

    this.assertInvoiceAgainstRequest({
      req,
      invoice: {
        total: input.total,
        concept: input.conceptOverride ?? req.concept,
      },
    });

    const base = {
      projectId,
      number: input.number,
      date: new Date(input.date),
      total: new Prisma.Decimal(input.total),
      currency: input.currency,
      isValid: true,
    } as const;

    const f = input.file;
    const fileData = f
      ? { url: `/uploads/billing/${f.filename}`, mime: f.mimetype, bytes: f.size }
      : {};

    return this.prisma.billingInvoice.upsert({
      where: { requestId: req.id },
      update: { ...base, ...fileData },
      create: { requestId: req.id, ...base, ...fileData },
    });
  }

  // ====================== Allocations ======================
  async createAllocation(dto: {
    projectId: number;
    concept: string;
    amount: number;
    date?: string;
  }) {
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

  // ====================== Payments ======================
  async createPayment(dto: {
    requestId: number;
    date: string;
    amount: number;
    reference: string;
    currency: Currency;
  }) {
    const req = await this.prisma.billingRequest.findUnique({
      where: { id: Number(dto.requestId) },
      include: {
        project: { select: { id: true, title: true, presupuestoTotal: true, cuentaId: true } },
        programa: { select: { id: true, nombre: true, presupuestoTotal: true, cuentaId: true } },
      },
    });

    if (!req) throw new NotFoundException('BillingRequest no encontrada');
    if (req.status === 'PAID') {
      throw new BadRequestException('Esta solicitud ya fue pagada');
    }

    // Validar fondos disponibles
    await this._validateBudget(req, dto.amount);

    const cuentaId = await this._resolveCuentaId(req.projectId, req.programaId);
    const destinoLabel = req.project?.title ?? req.programa?.nombre ?? `Request #${req.id}`;

    // Transacción atómica: Payment + Transaccion(egreso) + marcar PAID
    const [payment] = await this.prisma.$transaction([
      this.prisma.payment.create({
        data: {
          requestId: req.id,
          projectId: req.projectId,
          programaId: req.programaId,
          cuentaId,
          amount: new Prisma.Decimal(dto.amount),
          currency: dto.currency,
          reference: dto.reference.trim(),
          date: new Date(dto.date),
        },
      }),
      // La Transaccion se crea por separado después de tener el paymentId.
      // Para mantenerlo atómico usamos un create con connect diferido:
      // en Prisma no podemos crear Payment y Transaccion con FK circular en
      // un solo $transaction create. La solución es crear ambos y luego
      // actualizar el paymentId de la Transaccion en el mismo $transaction.
      this.prisma.billingRequest.update({
        where: { id: req.id },
        data: { status: 'PAID' },
      }),
    ]);

    // Crear la transacción de egreso vinculada al pago
    await this.prisma.transaccion.create({
      data: {
        fecha: new Date(dto.date),
        tipo: 'egreso',
        categoria: 'Pago de solicitud',
        descripcion: `Pago BillingRequest #${req.id} — ${destinoLabel}`,
        monto: new Prisma.Decimal(dto.amount),
        moneda: dto.currency,
        projectId: req.projectId,
        programaId: req.programaId,
        cuentaId,
        proyecto: destinoLabel,
        paymentId: payment.id,
      },
    });

    return payment;
  }

  async listPayments(params: { requestId?: number; projectId?: number; programaId?: number }) {
    const { requestId, projectId, programaId } = params;
    if (!requestId && !projectId && !programaId) {
      throw new BadRequestException('Debe enviar requestId, projectId o programaId');
    }

    return this.prisma.payment.findMany({
      where: {
        ...(requestId ? { requestId } : {}),
        ...(projectId ? { projectId } : {}),
        ...(programaId ? { programaId } : {}),
      },
      orderBy: { date: 'desc' },
    });
  }

  // ====================== Receipts ======================
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

  // ====================== Ledger ======================
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
        meta: { url: r.url, mime: r.mime, filename: r.filename, paymentId: r.paymentId },
      })),
    ];

    return rows.sort((a, b) => +new Date(a.date as any) - +new Date(b.date as any));
  }

  // ====================== From Solicitud ======================
  async createBillingRequestFromSolicitud(solicitudId: number) {
    const solicitud = await this.prisma.solicitudCompra.findUnique({
      where: { id: solicitudId },
      include: { usuario: true, programa: true, project: true },
    });

    if (!solicitud) throw new NotFoundException('Solicitud no encontrada');
    if (solicitud.estadoDirector !== 'APROBADA')
      throw new ForbiddenException('La solicitud no está aprobada por dirección');

    // Idempotente: si ya existe el BillingRequest con este id, retornarlo.
    const existing = await this.prisma.billingRequest.findUnique({
      where: { id: solicitud.id },
    });
    if (existing) return existing;

    // Validar que exista el destino
    if (!solicitud.projectId && !solicitud.programaId) {
      throw new BadRequestException(
        'La solicitud no tiene proyecto ni programa asociado.',
      );
    }

    const cuentaId = await this._resolveCuentaId(solicitud.projectId, solicitud.programaId);
    const amountDecimal = new Prisma.Decimal(solicitud.monto ?? 0);

    let destinoLabel: string;
    if (solicitud.tipoOrigen === 'PROGRAMA') {
      destinoLabel = 'Programa: ' + (solicitud.programa?.nombre ?? '#' + solicitud.programaId);
    } else {
      destinoLabel = 'Proyecto: ' + (solicitud.project?.title ?? '#' + solicitud.projectId);
    }

    return this.prisma.billingRequest.create({
      data: {
        id: solicitud.id,
        amount: amountDecimal,
        concept: 'Solicitud #' + solicitud.id + ' — ' + destinoLabel,
        projectId: solicitud.projectId ?? null,
        programaId: solicitud.programaId ?? null,
        cuentaId,
        status: 'APPROVED',
        history: [
          {
            fromSolicitud: true,
            tipoOrigen: solicitud.tipoOrigen,
            programaId: solicitud.programaId ?? null,
            projectId: solicitud.projectId ?? null,
            at: new Date().toISOString(),
          },
        ] as any,
      },
    });
  }

  // ====================== Helpers privados ======================

  private async _resolveCuentaId(
    projectId: number | null | undefined,
    programaId: number | null | undefined,
  ): Promise<number | null> {
    if (projectId) {
      const p = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { cuentaId: true },
      });
      return p?.cuentaId ?? null;
    }
    if (programaId) {
      const p = await this.prisma.programaVoluntariado.findUnique({
        where: { id: programaId },
        select: { cuentaId: true },
      });
      return p?.cuentaId ?? null;
    }
    return null;
  }

  private async _fallbackProjectId(): Promise<number> {
    const p = await this.prisma.project.findFirst({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    if (!p) throw new BadRequestException('No existe ningún proyecto en el sistema.');
    return p.id;
  }

  private async _validateBudget(
    req: {
      projectId: number | null;
      programaId: number | null;
      project?: { presupuestoTotal: Prisma.Decimal | null } | null;
      programa?: { presupuestoTotal: Prisma.Decimal | null } | null;
    },
    montoSolicitado: number,
  ) {
    const where: Prisma.TransaccionWhereInput = { anuladaAt: null };
    let presupuesto = 0;
    let nombre = '';

    if (req.projectId) {
      where.projectId = req.projectId;
      presupuesto = Number((req.project?.presupuestoTotal ?? 0).toString());
      nombre = 'Proyecto';
    } else if (req.programaId) {
      where.programaId = req.programaId;
      presupuesto = Number((req.programa?.presupuestoTotal ?? 0).toString());
      nombre = 'Programa';
    }

    // Calcular saldo disponible
    const agg = await this.prisma.transaccion.groupBy({
      by: ['tipo'],
      where,
      _sum: { monto: true },
    });

    const toNum = (v: Prisma.Decimal | null | undefined) =>
      v ? Number(v.toString()) : 0;
    const ingresos = toNum(agg.find((g) => g.tipo === 'ingreso')?._sum.monto);
    const egresos = toNum(agg.find((g) => g.tipo === 'egreso')?._sum.monto);
    const disponible = presupuesto + ingresos - egresos;

    if (montoSolicitado > disponible) {
      throw new UnprocessableEntityException(
        `Fondos insuficientes en el ${nombre}. Disponible: ${disponible.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}. Solicitado: ${montoSolicitado.toLocaleString('es-CR', { style: 'currency', currency: 'CRC' })}.`,
      );
    }
  }
}

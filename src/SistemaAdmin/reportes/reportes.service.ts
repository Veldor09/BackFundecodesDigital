import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FiltroInformeDto, TipoPeriodo } from './dto/filtro-informe.dto';
import PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import * as fs from 'fs';
import * as path from 'path';

const LOGO_PATH = path.join(__dirname, 'assets', 'logo.png');

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async generarInforme(filtros: FiltroInformeDto) {
    const { periodo, anio, fechaInicio, fechaFin, tipoReporte, modulos, cuentaId } = filtros;
    const hoy = new Date();
    const anioActual = hoy.getFullYear();
    const anioAnterior = anioActual - 1;

    let start: Date;
    let end: Date;

    if (periodo === TipoPeriodo.ANIO) {
      const anioValido = anio ?? anioActual;
      start = new Date(`${anioValido}-01-01`);
      end = new Date(`${anioValido}-12-31T23:59:59.999Z`);
    } else if (periodo === TipoPeriodo.RANGO) {
      const fechaInicioValida = fechaInicio ?? `${anioAnterior}-01-01`;
      const fechaFinValida = fechaFin ?? `${anioActual}-12-31`;
      start = new Date(fechaInicioValida);
      end = new Date(`${fechaFinValida}T23:59:59.999Z`);
    } else {
      start = new Date(`${anioAnterior}-01-01`);
      end = new Date(`${anioAnterior}-12-31T23:59:59.999Z`);
    }

    const detalles: Record<string, any> = {};
    let totalGlobal = 0;

    const modulosArray = Array.isArray(modulos)
      ? modulos
      : String(modulos).split(',').map((m) => m.trim());

    const cuentaIdNum = cuentaId ? Number(cuentaId) : undefined;

    for (const modulo of modulosArray) {
      const data = await this.obtenerDatosModulo(modulo, start, end, cuentaIdNum);
      const agrupado = data[0]?._esCuenta ? {} : this.agruparPorPeriodo(data, tipoReporte);
      detalles[modulo] = { total: data.length, grupos: agrupado, items: data };
      totalGlobal += data.length;
    }

    return {
      filtros: { ...filtros, anio: anio ?? anioActual, fechaInicio: start, fechaFin: end },
      totalRegistros: totalGlobal,
      fechaGeneracion: new Date(),
      detalles,
    };
  }

  async generarReporteSeleccion(modulo: string, datos: any[], formato: string): Promise<Buffer> {
    const data = {
      totalRegistros: datos.length,
      filtros: {
        periodo: 'SELECCION',
        tipoReporte: 'Selección actual',
        fechaInicio: new Date(),
        fechaFin: new Date(),
        anio: new Date().getFullYear(),
      },
      fechaGeneracion: new Date(),
      detalles: {
        [modulo]: { total: datos.length, grupos: {}, items: datos },
      },
    };
    if (['xlsx', 'excel', 'xls'].includes(formato.toLowerCase())) {
      return this.generarExcel(data);
    }
    return this.generarPdf(data);
  }

  private async obtenerDatosModulo(modulo: string, start: Date, end: Date, cuentaId?: number) {
    const key = modulo.toLowerCase().trim();
    try {
      if (['project', 'projects'].includes(key))
        return this.prisma.project.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });

      if (['billing', 'facturacion'].includes(key))
        return this.prisma.billingRequest.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });

      if (['solicitud', 'solicitudes'].includes(key))
        return this.prisma.solicitudCompra.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            usuario: { select: { id: true, name: true, email: true } },
            programa: { select: { id: true, nombre: true } },
            project: { select: { id: true, title: true } },
          },
        });

      if (['collaborator', 'collaborators', 'colaborador', 'colaboradores'].includes(key))
        return this.prisma.collaborator.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });

      if (['volunteer', 'volunteers', 'voluntario', 'voluntarios'].includes(key)) {
        return this.prisma.voluntario.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            programas: {
              include: { programa: { select: { id: true, nombre: true, lugar: true } } },
            },
          },
        });
      }

      // 🆕 Programas de voluntariado: incluyen total de voluntarios asignados
      // y horas acumuladas, datos clave para rendir cuentas en reuniones.
      if (['programa', 'programas', 'program', 'programs'].includes(key)) {
        const programas = await this.prisma.programaVoluntariado.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            voluntarios: {
              select: {
                voluntarioId: true,
                horasTotales: true,
                pagoRealizado: true,
                origen: true,
                voluntario: { select: { id: true, nombreCompleto: true } },
              },
            },
            _count: { select: { voluntarios: true } },
          },
        });
        return programas.map((p) => ({
          ...p,
          // Campo derivado consumible por el FE/PDF.
          totalVoluntarios: p._count.voluntarios,
          totalHoras: p.voluntarios.reduce((acc, a) => acc + (a.horasTotales ?? 0), 0),
        }));
      }

      // 🆕 Sanciones a voluntarios: útil para reportar disciplina.
      if (['sancion', 'sanciones'].includes(key)) {
        return this.prisma.sancion.findMany({
          where: { createdAt: { gte: start, lte: end } },
          include: {
            voluntario: { select: { id: true, nombreCompleto: true } },
          },
        });
      }

      if (['contabilidad', 'transacciones', 'transactions'].includes(key)) {
        // Vista por cuenta: datos en tiempo real con proyectos, programas y movimientos.
        const cuentas = await this.prisma.cuenta.findMany({
          where: cuentaId ? { id: cuentaId } : undefined,
          orderBy: { codigo: 'asc' },
          include: {
            area: { select: { id: true, nombre: true } },
            proyectos: {
              select: {
                id: true, title: true, status: true,
                presupuestoTotal: true, monedaPresupuesto: true,
              },
              orderBy: { title: 'asc' },
            },
            programas: {
              select: {
                id: true, nombre: true,
                presupuestoTotal: true, monedaPresupuesto: true,
              },
              orderBy: { nombre: 'asc' },
            },
          },
        });

        const toNum = (v: any): number =>
          v == null ? 0
          : typeof v === 'object' && 'toNumber' in v ? (v as any).toNumber()
          : Number(v);

        const result: any[] = [];
        for (const cuenta of cuentas) {
          const txsPeriodo = await this.prisma.transaccion.findMany({
            where: { cuentaId: cuenta.id, fecha: { gte: start, lte: end } },
            orderBy: { fecha: 'asc' },
          });

          const todosLosTxs = await this.prisma.transaccion.findMany({
            where: { cuentaId: cuenta.id, anuladaAt: null },
            select: { tipo: true, monto: true },
          });

          let ingresos = 0;
          let egresos = 0;
          for (const tx of todosLosTxs) {
            const m = toNum(tx.monto);
            if (String(tx.tipo).toLowerCase() === 'ingreso') ingresos += m;
            else egresos += m;
          }

          const presupuestoAsignado =
            cuenta.proyectos.reduce((a, p) => a + toNum(p.presupuestoTotal), 0) +
            cuenta.programas.reduce((a, p) => a + toNum(p.presupuestoTotal), 0);

          result.push({
            _esCuenta: true,
            id: cuenta.id,
            nombre: cuenta.nombre,
            codigo: (cuenta as any).codigo ?? '',
            monedaBase: (cuenta as any).monedaBase ?? 'CRC',
            activa: (cuenta as any).activa ?? true,
            areaNombre: cuenta.area?.nombre ?? '-',
            proyectos: cuenta.proyectos,
            programas: cuenta.programas,
            transacciones: txsPeriodo.map((t) => ({
              fecha: t.fecha,
              tipo: t.tipo,
              categoria: (t as any).categoria ?? '-',
              moneda: (t as any).moneda ?? (cuenta as any).monedaBase ?? 'CRC',
              monto: toNum(t.monto),
              descripcion: (t as any).descripcion ?? '-',
            })),
            totales: {
              presupuestoAsignado,
              ingresos,
              egresos,
              disponible: presupuestoAsignado + ingresos - egresos,
            },
          });
        }
        return result;
      }

      if (['visitacion', 'visitaciones'].includes(key)) {
        return this.prisma.visitacion.findMany({
          where: { fecha: { gte: start, lte: end } },
          orderBy: { fecha: 'desc' },
        });
      }

      if (['area', 'areas'].includes(key)) {
        return this.prisma.area.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      }

      if (['auditoria', 'auditorias'].includes(key)) {
        return this.prisma.auditoria.findMany({
          where: { createdAt: { gte: start, lte: end } },
          orderBy: { createdAt: 'desc' },
        });
      }

      return [];
    } catch (err) {
      console.error(`❌ Error obteniendo datos del módulo "${modulo}":`, err);
      return [];
    }
  }

  private agruparPorPeriodo(data: any[], tipoReporte: string) {
    const grupos: Record<string, number> = {};
    for (const item of data) {
      const fecha = new Date(item.createdAt || item.fecha);
      let clave = '';
      switch (tipoReporte) {
        case 'Mensual':
          clave = fecha.toLocaleString('es-CR', { month: 'long' });
          break;
        case 'Trimestral':
          clave = `Trimestre ${Math.ceil((fecha.getMonth() + 1) / 3)}`;
          break;
        case 'Semestral':
          clave = `Semestre ${fecha.getMonth() < 6 ? '1' : '2'}`;
          break;
        default:
          clave = 'Año completo';
      }
      grupos[clave] = (grupos[clave] || 0) + 1;
    }
    return Object.keys(grupos).length ? grupos : { 'Sin datos registrados': 0 };
  }

  async generarPdf(data: any): Promise<Buffer> {
  const MARGIN = 55;
  const PAGE_W = 595.28; // A4 width in pts
  const HEADER_H = 65;
  const BRAND = '#003366';

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const buffers: Uint8Array[] = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const fechaGeneracion = new Date().toLocaleString('es-CR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // ===== ENCABEZADO INSTITUCIONAL =====
  doc.save();
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(BRAND);
  doc.restore();

  // Logo
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, MARGIN, 8, { height: 50, fit: [85, 50] });
    } catch { /* sin logo */ }
  }

  // Fecha en esquina derecha
  doc.font('Helvetica').fontSize(8).fillColor('#cce0f5')
    .text(`Generado: ${fechaGeneracion}`, MARGIN, 28, { align: 'right', width: PAGE_W - MARGIN * 2 });

  // Línea divisora bajo el header
  doc.moveTo(0, HEADER_H).lineTo(PAGE_W, HEADER_H).strokeColor('#002244').lineWidth(1.5).stroke();

  doc.y = HEADER_H + 18;

  const { filtros, totalRegistros, detalles } = data;

  // ===== RESUMEN GENERAL =====
  doc.font('Helvetica-Bold').fontSize(13).fillColor(BRAND)
    .text('Resumen General', MARGIN, doc.y);
  doc.moveDown(0.5);

  const infoY = doc.y;
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND)
    .text('Periodo analizado:', MARGIN, infoY, { continued: true, width: 130 });
  doc.font('Helvetica').fillColor('#000')
    .text(
      filtros.periodo === 'ANIO'
        ? String(filtros.anio)
        : filtros.periodo === 'SELECCION'
          ? 'Selección actual (filtro aplicado)'
          : `${this.formatDate(filtros.fechaInicio)} al ${this.formatDate(filtros.fechaFin)}`,
      { continued: false }
    );

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND)
    .text('Tipo de reporte:', MARGIN, doc.y, { continued: true, width: 130 });
  doc.font('Helvetica').fillColor('#000').text(filtros.tipoReporte);

  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND).text('Módulos incluidos:', MARGIN);
  doc.moveDown(0.2);
  doc.font('Helvetica').fontSize(9).fillColor('#000');
  for (const [modulo, detalle] of Object.entries<any>(detalles)) {
    const nombre = this.labelModulo(modulo);
    const esCuenta = detalle.items?.[0]?._esCuenta;
    const unidad = esCuenta ? 'cuenta' : 'registro';
    doc.text(`   • ${nombre}: ${detalle.total} ${unidad}${detalle.total !== 1 ? 's' : ''}`, { indent: 8 });
  }
  doc.moveDown(0.5);
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(BRAND)
    .text('Total general:', MARGIN, doc.y, { continued: true, width: 130 });
  doc.font('Helvetica').fillColor('#000')
    .text(`${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`);
  doc.moveDown(1);
  doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
  doc.moveDown(1.5);

  // ===== DETALLES POR MÓDULO =====
  const config: Record<string, any[]> = {
    projects: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'title', label: 'Título del proyecto', width: 130 },
      { key: 'place', label: 'Lugar', width: 100 },
      { key: 'area', label: 'Área', width: 90 },
      { key: 'status', label: 'Estado', width: 75, format: (v) => this.traducirEstado(v) },
      { key: 'createdAt', label: 'Fecha creación', width: 80, format: (v) => this.formatDate(v) },
    ],
    billing: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'amount', label: 'Monto', width: 90, format: (v) => this.formatMoney(v) },
      { key: 'concept', label: 'Concepto', width: 145 },
      { key: 'status', label: 'Estado', width: 85, format: (v) => this.traducirEstado(v) },
      { key: 'createdAt', label: 'Fecha', width: 85, format: (v) => this.formatDate(v) },
    ],
    solicitudes: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'titulo', label: 'Título', width: 130 },
      { key: 'estado', label: 'Estado general', width: 85, format: (v) => this.traducirEstado(v) },
      { key: 'estadoContadora', label: 'Contadora', width: 85, format: (v) => this.traducirEstado(v) },
      { key: 'estadoDirector', label: 'Director', width: 85, format: (v) => this.traducirEstado(v) },
      { key: 'createdAt', label: 'Fecha', width: 80, format: (v) => this.formatDate(v) },
    ],
    collaborators: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'nombreCompleto', label: 'Nombre completo', width: 145 },
      { key: 'correo', label: 'Correo electrónico', width: 145 },
      { key: 'cedula', label: 'Cédula', width: 80 },
      { key: 'telefono', label: 'Teléfono', width: 80 },
    ],
    volunteers: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'nombre', label: 'Nombre', width: 140 },
      { key: 'nacionalidad', label: 'Nacionalidad', width: 90 },
      { key: 'email', label: 'Email', width: 130 },
      { key: 'fechaEntrada', label: 'Entrada', width: 80, format: (v) => this.formatDate(v) },
      { key: 'fechaSalida', label: 'Salida', width: 80, format: (v) => v ? this.formatDate(v) : 'En curso' },
      { key: 'ong', label: 'ONG', width: 80 },
    ],
    programas: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'nombre', label: 'Nombre del programa', width: 145 },
      { key: 'lugar', label: 'Lugar', width: 100 },
      { key: 'limiteParticipantes', label: 'Cupo máx.', width: 70 },
      { key: 'totalVoluntarios', label: 'Voluntarios', width: 80 },
      { key: 'totalHoras', label: 'Horas totales', width: 80 },
    ],
    sanciones: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'tipo', label: 'Tipo', width: 80 },
      { key: 'motivo', label: 'Motivo', width: 130 },
      { key: 'descripcion', label: 'Descripción', width: 200 },
      { key: 'createdAt', label: 'Fecha', width: 80, format: (v) => this.formatDate(v) },
    ],
    contabilidad: [
      { key: 'fecha', label: 'Fecha', width: 80, format: (v) => this.formatDate(v) },
      { key: 'tipo', label: 'Tipo', width: 65 },
      { key: 'categoria', label: 'Categoría', width: 100 },
      { key: 'proyectoNombre', label: 'Proyecto / Programa', width: 120 },
      { key: 'moneda', label: 'Moneda', width: 55 },
      { key: 'monto', label: 'Monto', width: 100, format: (v, row) => this.formatMoney(v, row?.moneda) },
      { key: 'descripcion', label: 'Descripción', width: 130 },
    ],
    visitaciones: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'fecha', label: 'Fecha', width: 90, format: (v) => this.formatDate(v) },
      { key: 'totalPersonas', label: 'Total personas', width: 95 },
      { key: 'nacionales', label: 'Nacionales', width: 85 },
      { key: 'extranjeros', label: 'Extranjeros', width: 85 },
      { key: 'notas', label: 'Notas', width: 150 },
    ],
    areas: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'nombre', label: 'Nombre del área', width: 155 },
      { key: 'descripcion', label: 'Descripción', width: 210 },
      { key: 'activa', label: 'Activa', width: 55, format: (v) => (v ? 'Sí' : 'No') },
      { key: 'createdAt', label: 'Fecha creación', width: 80, format: (v) => this.formatDate(v) },
    ],
    auditoria: [
      { key: 'userName', label: 'Usuario', width: 110 },
      { key: 'userEmail', label: 'Email', width: 130 },
      { key: 'accion', label: 'Acción', width: 120 },
      { key: 'entidad', label: 'Entidad', width: 80 },
      { key: 'detalle', label: 'Detalle', width: 130 },
      { key: 'ip', label: 'IP', width: 80 },
      { key: 'createdAt', label: 'Fecha', width: 80, format: (v) => this.formatDate(v) },
    ],
  };

  let primerModulo = true;
  for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
    const items = detalle.items || [];
    if (items.length === 0) continue;

    if (primerModulo) {
      doc.addPage();
      primerModulo = false;
    } else if (doc.y > doc.page.height - 160) {
      doc.addPage();
    }

    const nombreModulo = this.labelModulo(modulo).toUpperCase();

    // ─── Banner de módulo: mismo diseño que los headers de contabilidad ───────
    if (doc.y > doc.page.height - 140) { doc.addPage(); doc.y = 70; }
    doc.moveDown(0.5);
    const bannerY = doc.y;
    const bannerW = PAGE_W - MARGIN * 2;
    doc.save().rect(MARGIN, bannerY, bannerW, 34).fill(BRAND).restore();
    doc.font('Helvetica-Bold').fontSize(12).fillColor('white')
      .text(nombreModulo, MARGIN + 10, bannerY + 10, { width: bannerW - 120, lineBreak: false });
    const _esCuentaMod = modulo === 'contabilidad' && items[0]?._esCuenta;
    const _unidadMod = _esCuentaMod ? 'cuenta' : 'registro';
    doc.font('Helvetica').fontSize(9).fillColor('#99c2e8')
      .text(`${items.length} ${_unidadMod}${items.length !== 1 ? 's' : ''}`,
        MARGIN + bannerW - 100, bannerY + 13, { width: 90, align: 'right', lineBreak: false });
    doc.y = bannerY + 34 + 10;

    if (modulo === 'contabilidad' && items[0]?._esCuenta) {
      this.drawContabilidadPorCuenta(doc, items, MARGIN, PAGE_W);
    } else if (['volunteers', 'voluntarios'].includes(modulo)) {
      this.drawVoluntariosPorPersona(doc, items, MARGIN, PAGE_W);
    } else {
      if (modulo === 'contabilidad') {
        this.drawContabilidadSummary(doc, items, MARGIN, PAGE_W);
        doc.moveDown(0.8);
      }

      const cols =
        config[modulo] ??
        Object.keys(items[0] || {})
          .filter((k) => !['project', 'montoNum'].includes(k))
          .slice(0, 7)
          .map((k) => ({ key: k, label: k.toUpperCase(), width: 70 }));

      this.drawTableStable(doc, cols, items);
      doc.moveDown(1);
      doc.moveTo(MARGIN, doc.y).lineTo(PAGE_W - MARGIN, doc.y).strokeColor('#cccccc').lineWidth(0.5).stroke();
    }
  }

  // ===== PIE DE PÁGINA =====
  // PDFKit auto-agrega páginas cuando doc.y + lineHeight > page.maxY(), donde
  // maxY() = page.height - margins.bottom. Al poner margins.bottom = 0
  // temporalmente, maxY() sube a page.height y el texto en y = page.height-38
  // no supera ese umbral, evitando las páginas en blanco extra.
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    const pageMargins = (doc.page as any).margins;
    const savedBottom = pageMargins.bottom;
    pageMargins.bottom = 0;
    const bottomY = doc.page.height - 38;
    doc.moveTo(MARGIN, bottomY - 6).lineTo(PAGE_W - MARGIN, bottomY - 6)
      .strokeColor('#cccccc').lineWidth(0.4).stroke();
    doc.fontSize(8).fillColor('gray').font('Helvetica')
      .text('FUNDECODES DIGITAL – Sistema Administrativo · Documento confidencial',
        MARGIN, bottomY, { width: PAGE_W - MARGIN * 2 - 80, lineBreak: false });
    doc.text(`Página ${i + 1} de ${pageRange.count}`,
      PAGE_W - MARGIN - 80, bottomY, { width: 80, align: 'right', lineBreak: false });
    pageMargins.bottom = savedBottom;
  }

  doc.end();
  await new Promise((resolve) => doc.on('end', resolve));
  return Buffer.concat(buffers);
}

private drawVoluntariosPorPersona(
  doc: PDFKit.PDFDocument,
  voluntarios: any[],
  margin: number,
  pageW: number,
): void {
  const BRAND = '#003366';
  const bodyMaxY = doc.page.height - 90;

  for (const v of voluntarios) {
    if (doc.y > bodyMaxY - 110) { doc.addPage(); doc.y = 70; }

    const headerW = pageW - margin * 2;

    // ─── Header del voluntario ──────────────────────────────────────────────
    const hY = doc.y;
    doc.save().rect(margin, hY, headerW, 32).fill(BRAND).restore();
    doc.font('Helvetica-Bold').fontSize(11).fillColor('white')
      .text(v.nombre || '(Sin nombre)', margin + 10, hY + 10,
        { width: headerW - 110, lineBreak: false });
    const ongLabel = v.ong ? String(v.ong) : '';
    if (ongLabel) {
      doc.font('Helvetica').fontSize(8).fillColor('#99c2e8')
        .text(ongLabel, margin + headerW - 85, hY + 12, { width: 75, align: 'right' });
    }
    doc.y = hY + 32 + 5;

    // ─── Datos del voluntario ───────────────────────────────────────────────
    doc.font('Helvetica').fontSize(8.5).fillColor('#444')
      .text(
        `Nacionalidad: ${v.nacionalidad ?? '-'}   ·   ` +
        `Email: ${v.email ?? '-'}   ·   ` +
        `Entrada: ${this.formatDate(v.fechaEntrada)}   ·   ` +
        `Salida: ${v.fechaSalida ? this.formatDate(v.fechaSalida) : 'En curso'}`,
        margin, doc.y,
      );
    doc.moveDown(0.6);

    // ─── Programas asignados ─────────────────────────────────────────────────
    if (doc.y > bodyMaxY - 65) { doc.addPage(); doc.y = 70; }
    const programasAsignados: any[] = v.programas ?? [];
    if (programasAsignados.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND)
        .text('PROGRAMAS ASIGNADOS', margin, doc.y);
      doc.moveDown(0.3);
      this.drawTableStable(doc, [
        { key: 'programaNombre', label: 'Programa', width: 200 },
        { key: 'lugar', label: 'Lugar', width: 120 },
        { key: 'horasTotales', label: 'Horas', width: 70,
          format: (val) => val != null ? String(val) : '0' },
        { key: 'pagoRealizado', label: 'Pago realizado', width: 80,
          format: (val) => val == null ? '-' : val ? 'Sí' : 'No' },
        { key: 'origen', label: 'Origen', width: 80 },
      ], programasAsignados.map((pa) => ({
        programaNombre: pa.programa?.nombre ?? '-',
        lugar: pa.programa?.lugar ?? '-',
        horasTotales: pa.horasTotales ?? 0,
        pagoRealizado: pa.pagoRealizado,
        origen: pa.origen ?? '-',
      })));
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#888')
        .text('Sin programas asignados.', margin, doc.y);
    }

    // ─── Separador ──────────────────────────────────────────────────────────
    doc.moveDown(1.2);
    if (doc.y < bodyMaxY - 5) {
      doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
    }
    doc.moveDown(0.8);
  }
}

private drawContabilidadSummary(doc: PDFKit.PDFDocument, items: any[], margin: number, pageW: number): void {
  const BRAND = '#003366';
  let totalIngresos = 0;
  let totalEgresos = 0;

  for (const tx of items) {
    const monto = Number(tx.montoNum ?? tx.monto ?? 0);
    if (String(tx.tipo).toUpperCase() === 'INGRESO') totalIngresos += monto;
    else totalEgresos += monto;
  }

  const balance = totalIngresos - totalEgresos;
  const balanceColor = balance >= 0 ? '#1a7a3b' : '#cc2200';

  // Fondo del resumen
  const boxH = 48;
  const boxY = doc.y;
  doc.save().rect(margin, boxY, pageW - margin * 2, boxH).fill('#eef3fa').restore();
  doc.save().rect(margin, boxY, 4, boxH).fill(BRAND).restore();

  doc.font('Helvetica-Bold').fontSize(10).fillColor(BRAND)
    .text('Resumen Financiero del Período', margin + 10, boxY + 6);

  const colW = (pageW - margin * 2 - 14) / 3;
  const labelY = boxY + 20;
  const valY = boxY + 31;

  // Ingresos
  doc.font('Helvetica').fontSize(8).fillColor('#555')
    .text('Total Ingresos', margin + 10, labelY, { width: colW });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#1a7a3b')
    .text(this.formatMoney(totalIngresos, 'CRC'), margin + 10, valY, { width: colW });

  // Egresos
  doc.font('Helvetica').fontSize(8).fillColor('#555')
    .text('Total Egresos', margin + 10 + colW, labelY, { width: colW });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#cc2200')
    .text(this.formatMoney(totalEgresos, 'CRC'), margin + 10 + colW, valY, { width: colW });

  // Balance
  doc.font('Helvetica').fontSize(8).fillColor('#555')
    .text('Balance Neto', margin + 10 + colW * 2, labelY, { width: colW });
  doc.font('Helvetica-Bold').fontSize(10).fillColor(balanceColor)
    .text(this.formatMoney(balance, 'CRC'), margin + 10 + colW * 2, valY, { width: colW });

  doc.y = boxY + boxH + 6;
}

private drawContabilidadPorCuenta(
  doc: PDFKit.PDFDocument,
  cuentas: any[],
  margin: number,
  pageW: number,
): void {
  const BRAND = '#003366';
  const bodyMaxY = doc.page.height - 90;

  for (const cuenta of cuentas) {
    // Espacio mínimo: header(38) + metadata(14) + moveDown(7) + box(50) + buffer(11) ≈ 120px
    if (doc.y > bodyMaxY - 120) {
      doc.addPage();
      doc.y = 70;
    }

    const headerW = pageW - margin * 2;

    // ─── Header de la cuenta ────────────────────────────────────────────────
    const hY = doc.y;
    doc.save().rect(margin, hY, headerW, 38).fill(BRAND).restore();
    doc.font('Helvetica').fontSize(8).fillColor('#99c2e8')
      .text((cuenta.codigo || ''), margin + 10, hY + 7, { lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(12).fillColor('white')
      .text(cuenta.nombre, margin + 10, hY + 17, { width: headerW - 100, lineBreak: false });
    doc.font('Helvetica-Bold').fontSize(8)
      .fillColor(cuenta.activa ? '#66cc88' : '#ff8888')
      .text(cuenta.activa ? 'ACTIVA' : 'ARCHIVADA',
        margin + headerW - 85, hY + 17, { width: 75, align: 'right' });
    doc.y = hY + 38 + 5;

    // ─── Metadata ──────────────────────────────────────────────────────────
    doc.font('Helvetica').fontSize(8.5).fillColor('#444')
      .text(`Área: ${cuenta.areaNombre}   ·   Moneda base: ${cuenta.monedaBase}`, margin, doc.y);
    doc.moveDown(0.5);

    // ─── Resumen financiero ─────────────────────────────────────────────────
    const { presupuestoAsignado, ingresos, egresos, disponible } = cuenta.totales;
    const mon: string = cuenta.monedaBase;
    const dispColor = disponible >= 0 ? '#1a7a3b' : '#cc2200';
    const boxY = doc.y;
    const boxH = 50;
    doc.save().rect(margin, boxY, headerW, boxH).fill('#eef3fa').restore();
    doc.save().rect(margin, boxY, 4, boxH).fill(BRAND).restore();

    const cw = (headerW - 14) / 4;
    const labs = ['Presupuesto asignado', 'Ingresos (acumulado)', 'Egresos (acumulado)', 'Fondos disponibles'];
    const vals = [presupuestoAsignado, ingresos, egresos, disponible];
    const fgCols = [BRAND, '#1a7a3b', '#cc2200', dispColor];
    for (let ci = 0; ci < 4; ci++) {
      const cx = margin + 10 + cw * ci;
      doc.font('Helvetica').fontSize(7.5).fillColor('#666')
        .text(labs[ci], cx, boxY + 8, { width: cw - 5 });
      doc.font('Helvetica-Bold').fontSize(9.5).fillColor(fgCols[ci])
        .text(this.formatMoney(vals[ci], mon), cx, boxY + 20, { width: cw - 5 });
    }
    const totalDisponible = presupuestoAsignado + ingresos;
    const pct = totalDisponible > 0
      ? Math.min(100, (egresos / totalDisponible) * 100) : 0;
    doc.font('Helvetica').fontSize(7).fillColor('#888')
      .text(`Utilización de fondos: ${pct.toFixed(1)}%`, margin + 10, boxY + 38, { width: headerW - 14 });
    doc.y = boxY + boxH + 8;

    // ─── Proyectos ──────────────────────────────────────────────────────────
    if (doc.y > bodyMaxY - 65) { doc.addPage(); doc.y = 70; }
    if (cuenta.proyectos.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND)
        .text('PROYECTOS VINCULADOS', margin, doc.y);
      doc.moveDown(0.3);
      this.drawTableStable(doc, [
        { key: 'title', label: 'Proyecto', width: 200 },
        { key: 'status', label: 'Estado', width: 120,
          format: (v) => this.traducirEstado(v) },
        { key: 'presupuestoTotal', label: 'Presupuesto', width: 110,
          format: (v, row) => v != null ? this.formatMoney(v, row?.monedaPresupuesto) : 'Sin presupuesto' },
        { key: 'monedaPresupuesto', label: 'Moneda', width: 55,
          format: (v) => v ?? '-' },
      ], cuenta.proyectos);
      doc.moveDown(0.5);
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#888')
        .text('Sin proyectos vinculados.', margin, doc.y);
      doc.moveDown(0.5);
    }

    // ─── Programas ──────────────────────────────────────────────────────────
    if (doc.y > bodyMaxY - 65) { doc.addPage(); doc.y = 70; }
    if (cuenta.programas.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND)
        .text('PROGRAMAS VINCULADOS', margin, doc.y);
      doc.moveDown(0.3);
      this.drawTableStable(doc, [
        { key: 'nombre', label: 'Programa', width: 230 },
        { key: 'presupuestoTotal', label: 'Presupuesto', width: 140,
          format: (v, row) => v != null ? this.formatMoney(v, row?.monedaPresupuesto) : 'Sin presupuesto' },
        { key: 'monedaPresupuesto', label: 'Moneda', width: 115,
          format: (v) => v ?? '-' },
      ], cuenta.programas);
      doc.moveDown(0.5);
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#888')
        .text('Sin programas vinculados.', margin, doc.y);
      doc.moveDown(0.5);
    }

    // ─── Movimientos del período ─────────────────────────────────────────────
    if (doc.y > bodyMaxY - 65) { doc.addPage(); doc.y = 70; }
    const txs: any[] = cuenta.transacciones ?? [];
    if (txs.length > 0) {
      doc.font('Helvetica-Bold').fontSize(9).fillColor(BRAND)
        .text(`MOVIMIENTOS DEL PERÍODO (${txs.length})`, margin, doc.y);
      doc.moveDown(0.3);
      this.drawTableStable(doc, [
        { key: 'fecha', label: 'Fecha', width: 75,
          format: (v) => this.formatDate(v) },
        { key: 'tipo', label: 'Tipo', width: 65 },
        { key: 'categoria', label: 'Categoría', width: 110 },
        { key: 'monto', label: 'Monto', width: 130,
          format: (v, row) => this.formatMoney(v, row?.moneda) },
        { key: 'descripcion', label: 'Descripción', width: 105 },
      ], txs);
    } else {
      doc.font('Helvetica').fontSize(8.5).fillColor('#888')
        .text('Sin movimientos en el período seleccionado.', margin, doc.y);
    }

    // ─── Separador entre cuentas ────────────────────────────────────────────
    doc.moveDown(1.5);
    if (doc.y < bodyMaxY - 5) {
      doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y)
        .strokeColor('#cccccc').lineWidth(0.5).stroke();
    }
    doc.moveDown(1);
  }
}

private labelModulo(modulo: string): string {
  const map: Record<string, string> = {
    projects: 'Proyectos',
    billing: 'Facturación',
    collaborators: 'Colaboradores',
    volunteers: 'Voluntarios',
    solicitudes: 'Solicitudes de compra',
    programas: 'Programas de voluntariado',
    sanciones: 'Sanciones disciplinarias',
    contabilidad: 'Contabilidad',
    visitaciones: 'Visitación',
    areas: 'Áreas de trabajo',
    auditoria: 'Auditoría',
  };
  return map[modulo] ?? (modulo.charAt(0).toUpperCase() + modulo.slice(1));
}







  private drawTableStable(
  doc: PDFKit.PDFDocument,
  columns: { key: string; label: string; width: number; format?: (v: any, row?: any) => string }[],
  rows: any[],
) {
  const pageWidth = doc.page.width;
  const pageMargin = 55;
  const maxTableWidth = 485;
  const headerHeight = 28;
  const baseRowHeight = 28;
  const cellPadX = 7;
  const cellPadY = 7;
  const marginBottom = 90;
  const maxY = doc.page.height - marginBottom;
  let y = doc.y;

  let totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  // Siempre escalar para llenar el ancho disponible (ampliar o reducir)
  const scale = maxTableWidth / totalWidth;
  columns = columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }));
  totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  // Absorber diferencia de redondeo en la última columna
  const widthRemainder = maxTableWidth - totalWidth;
  if (widthRemainder !== 0) columns[columns.length - 1].width += widthRemainder;
  totalWidth = maxTableWidth;

  const startX = pageMargin; // siempre desde el margen izquierdo

  const drawHeader = () => {
    doc.save().rect(startX, y, totalWidth, headerHeight).fill('#dbe8f5').restore();
    // Borde inferior del encabezado
    doc.moveTo(startX, y + headerHeight).lineTo(startX + totalWidth, y + headerHeight)
      .strokeColor('#003366').lineWidth(0.8).stroke();
    let x = startX + cellPadX;
    doc.font('Helvetica-Bold').fontSize(9).fillColor('#003366');
    for (const col of columns) {
      const labelH = doc.heightOfString(col.label, { width: col.width - cellPadX * 2 });
      const labelY = y + (headerHeight - labelH) / 2;
      doc.text(col.label, x, labelY, { width: col.width - cellPadX * 2, align: 'left' });
      x += col.width;
    }
    y += headerHeight;
  };

  drawHeader();

  doc.font('Helvetica').fontSize(9).fillColor('#000');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const heights = columns.map((col) => {
      const val = col.format ? col.format(row[col.key], row) : this.stringifyValue(row[col.key]);
      return Math.max(
        doc.heightOfString(val, { width: col.width - cellPadX * 2 }) + cellPadY * 2,
        baseRowHeight
      );
    });
    const rowHeight = Math.max(...heights);

    if (y + rowHeight > maxY) {
      doc.addPage();
      y = 70;
      drawHeader();
    }

    // Fondo alternado
    if (i % 2 === 1) {
      doc.save().rect(startX, y, totalWidth, rowHeight).fill('#f7f9fb').restore();
    }

    let x = startX + cellPadX;
    for (const col of columns) {
      const val = col.format ? col.format(row[col.key], row) : this.stringifyValue(row[col.key]);
      doc.fillColor('#222').text(val, x, y + cellPadY, {
        width: col.width - cellPadX * 2,
        align: 'left',
        lineBreak: true,
      });
      x += col.width;
    }

    // Línea separadora de fila
    doc.moveTo(startX, y + rowHeight)
      .lineTo(startX + totalWidth, y + rowHeight)
      .strokeColor('#e0e0e0').lineWidth(0.3).stroke();

    y += rowHeight;
    // Sincronizar cursor de PDFKit con nuestra variable local para evitar
    // que diferencias en heightOfString generen auto-páginas inesperadas
    doc.y = Math.min(y, maxY);
  }

  doc.y = Math.min(y + 10, maxY - 10);
}

async generarExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Informe General');

  // ===== ENCABEZADO GENERAL (banner azul) =====
  sheet.mergeCells('A1:F1');
  const title = sheet.getCell('A1');
  title.value = 'FUNDECODES DIGITAL – Informe Consolidado de Gestión';
  title.font = { size: 16, bold: true, color: { argb: 'FFFFFFFF' } };
  title.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
  title.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 34;

  sheet.addRow([]);
  const fechaRow = sheet.addRow(['Fecha de generación:', new Date().toLocaleString('es-CR')]);
  fechaRow.getCell(1).font = { bold: true, color: { argb: '003366' } };
  const registrosRow = sheet.addRow(['Total de registros:', data.totalRegistros]);
  registrosRow.getCell(1).font = { bold: true, color: { argb: '003366' } };
  sheet.addRow([]);

  // ===== RESUMEN POR MÓDULO =====
  const resumenLabelRow = sheet.addRow(['RESUMEN POR MÓDULO']);
  if (resumenLabelRow) resumenLabelRow.getCell(1).font = { bold: true, size: 12, color: { argb: '003366' } };

  const headerRow = sheet.addRow(['Módulo', 'Total']);
  if (headerRow) {
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: '003366' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbe8f5' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    headerRow.height = 20;
  }

  let _resumenIdx = 0;
  for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
    const nombreModulo =
      modulo === 'projects' ? 'Proyectos'
      : modulo === 'billing' ? 'Facturación'
      : modulo === 'collaborators' ? 'Colaboradores'
      : modulo === 'volunteers' ? 'Voluntarios'
      : modulo === 'solicitudes' ? 'Solicitudes'
      : modulo === 'programas' ? 'Programas de voluntariado'
      : modulo === 'sanciones' ? 'Sanciones'
      : modulo === 'contabilidad' ? 'Contabilidad'
      : modulo === 'visitaciones' ? 'Visitación'
      : modulo === 'areas' ? 'Áreas'
      : modulo === 'auditoria' ? 'Auditoría'
      : modulo.charAt(0).toUpperCase() + modulo.slice(1);

    const esCuenta = modulo === 'contabilidad' && detalle.items?.[0]?._esCuenta;
    const dataRow = sheet.addRow([nombreModulo, esCuenta ? `${detalle.total} cuenta(s)` : detalle.total]);
    if (_resumenIdx % 2 === 1) {
      dataRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FB' } };
      });
    }
    _resumenIdx++;
  }

  sheet.addRow([]);
  const totalGenRow = sheet.addRow(['TOTAL GENERAL', data.totalRegistros]);
  if (totalGenRow) {
    totalGenRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: '003366' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbe8f5' } };
    });
  }

  sheet.getColumn(1).width = 38;
  sheet.getColumn(2).width = 20;

  // ===== DETALLES POR MÓDULO =====
  for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
    const items = detalle.items || [];
    if (items.length === 0) continue;

    const nombreModulo =
      modulo === 'projects' ? 'PROYECTOS'
      : modulo === 'billing' ? 'FACTURACIÓN'
      : modulo === 'collaborators' ? 'COLABORADORES'
      : modulo === 'volunteers' ? 'VOLUNTARIOS'
      : modulo === 'solicitudes' ? 'SOLICITUDES'
      : modulo === 'programas' ? 'PROGRAMAS DE VOLUNTARIADO'
      : modulo === 'sanciones' ? 'SANCIONES'
      : modulo === 'contabilidad' ? 'CONTABILIDAD'
      : modulo === 'visitaciones' ? 'VISITACIÓN'
      : modulo === 'areas' ? 'ÁREAS'
      : modulo === 'auditoria' ? 'AUDITORÍA'
      : modulo.toUpperCase();

    // Nueva hoja para el módulo
    const moduloSheet = workbook.addWorksheet(nombreModulo);

    moduloSheet.mergeCells('A1:F1');
    const header = moduloSheet.getCell('A1');
    header.value = nombreModulo;
    header.font = { size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
    header.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    moduloSheet.getRow(1).height = 30;

    moduloSheet.addRow([]);

    // ── Contabilidad: vista por cuenta (estructura nueva) ──────────────────
    if (modulo === 'contabilidad' && items[0]?._esCuenta) {
      this.addContabilidadPorCuentaSheet(moduloSheet, items);
      continue;
    }

    // ── Voluntarios: vista por persona con programas ────────────────────────
    if (['volunteers', 'voluntarios'].includes(modulo)) {
      this.addVoluntariosPorPersonaSheet(moduloSheet, items);
      continue;
    }

    // ===== Configurar columnas =====
    let columnas: { key: string; label: string }[] = [];

    if (modulo === 'projects') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'title', label: 'Título' },
        { key: 'place', label: 'Lugar' },
        { key: 'area', label: 'Área' },
        { key: 'status', label: 'Estado' },
        { key: 'createdAt', label: 'Creado' },
      ];
    } else if (modulo === 'billing') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'amount', label: 'Monto' },
        { key: 'concept', label: 'Concepto' },
        { key: 'status', label: 'Estado' },
        { key: 'createdAt', label: 'Fecha' },
      ];
    } else if (modulo === 'solicitudes') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'titulo', label: 'Título' },
        { key: 'estado', label: 'Estado' },
        { key: 'estadoContadora', label: 'Contadora' },
        { key: 'estadoDirector', label: 'Director' },
        { key: 'createdAt', label: 'Creada' },
      ];
    } else if (modulo === 'collaborators') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'nombreCompleto', label: 'Nombre Completo' },
        { key: 'correo', label: 'Correo' },
        { key: 'cedula', label: 'Cédula' },
        { key: 'fechaNacimiento', label: 'Fecha Nacimiento' },
        { key: 'telefono', label: 'Teléfono' },
      ];
    } else if (modulo === 'volunteers') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'nacionalidad', label: 'Nacionalidad' },
        { key: 'email', label: 'Email' },
        { key: 'fechaEntrada', label: 'Entrada' },
        { key: 'fechaSalida', label: 'Salida' },
        { key: 'ong', label: 'ONG' },
      ];
    } else if (modulo === 'programas') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'lugar', label: 'Lugar' },
        { key: 'limiteParticipantes', label: 'Cupo máximo' },
        { key: 'totalVoluntarios', label: 'Voluntarios asignados' },
        { key: 'totalHoras', label: 'Horas totales' },
      ];
    } else if (modulo === 'sanciones') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'motivo', label: 'Motivo' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'createdAt', label: 'Fecha' },
      ];
    } else if (modulo === 'contabilidad') {
      columnas = [
        { key: 'fecha', label: 'Fecha' },
        { key: 'tipo', label: 'Tipo' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'proyectoNombre', label: 'Proyecto / Programa' },
        { key: 'moneda', label: 'Moneda' },
        { key: 'monto', label: 'Monto' },
        { key: 'descripcion', label: 'Descripción' },
      ];
    } else if (modulo === 'visitaciones') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'fecha', label: 'Fecha' },
        { key: 'totalPersonas', label: 'Total Personas' },
        { key: 'nacionales', label: 'Nacionales' },
        { key: 'extranjeros', label: 'Extranjeros' },
        { key: 'notas', label: 'Notas' },
      ];
    } else if (modulo === 'areas') {
      columnas = [
        { key: 'id', label: 'ID' },
        { key: 'nombre', label: 'Nombre' },
        { key: 'descripcion', label: 'Descripción' },
        { key: 'activa', label: 'Activa' },
        { key: 'createdAt', label: 'Fecha de creación' },
      ];
    } else if (modulo === 'auditoria') {
      columnas = [
        { key: 'userName', label: 'Usuario' },
        { key: 'userEmail', label: 'Email' },
        { key: 'accion', label: 'Acción' },
        { key: 'entidad', label: 'Entidad' },
        { key: 'detalle', label: 'Detalle' },
        { key: 'ip', label: 'IP' },
        { key: 'createdAt', label: 'Fecha' },
      ];
    } else {
      columnas = Object.keys(items[0] || {}).slice(0, 6).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
      }));
    }

    // ===== Encabezados (fondo azul claro, texto azul oscuro) =====
    moduloSheet.addRow(columnas.map((c) => c.label));
    const headerRow2 = moduloSheet.lastRow;
    if (headerRow2) {
      headerRow2.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: '003366' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbe8f5' } };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      });
      headerRow2.height = 22;
    }

    // ===== Filas (filas alternas con fondo gris muy claro) =====
    items.forEach((item, rowIndex) => {
      const row = columnas.map((col) => {
        let val = item[col.key];

        if (
          typeof val === 'string' &&
          (col.key.toLowerCase().includes('estado') || col.key.toLowerCase().includes('status'))
        ) {
          return this.traducirEstado(val);
        }
        if (col.key.toLowerCase() === 'amount' && val != null) {
          return this.formatMoney(val);
        }
        if (val instanceof Date) return this.formatDate(val);
        if (val == null || val === '') return '-';
        if (typeof val === 'boolean') return val ? 'Sí' : 'No';
        return String(val);
      });

      const addedRow = moduloSheet.addRow(row);
      addedRow.alignment = { wrapText: true, vertical: 'top' };
      if (rowIndex % 2 === 1) {
        addedRow.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FB' } };
        });
      }
    });

    // ===== Ajuste de columnas: ancho basado en contenido =====
    const colWidths = columnas.map((c) => c.label.length + 4);
    for (const item of items) {
      columnas.forEach((col, idx) => {
        let raw: any = item[col.key];
        if (raw instanceof Date) raw = this.formatDate(raw);
        else if (typeof raw === 'boolean') raw = raw ? 'Sí' : 'No';
        else if (raw == null) raw = '';
        else raw = String(raw);
        colWidths[idx] = Math.max(colWidths[idx], Math.min((raw as string).length + 3, 60));
      });
    }
    moduloSheet.columns = colWidths.map((w) => ({ width: Math.max(w, 10) }));
    // Altura mínima de filas de datos
    moduloSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 3) row.height = 18;
    });
  }

  // ===== FORMATO GENERAL =====
  workbook.eachSheet((ws) => {
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin', color: { argb: 'cccccc' } },
          left: { style: 'thin', color: { argb: 'cccccc' } },
          bottom: { style: 'thin', color: { argb: 'cccccc' } },
          right: { style: 'thin', color: { argb: 'cccccc' } },
        };
      });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}







  private addVoluntariosPorPersonaSheet(sheet: ExcelJS.Worksheet, voluntarios: any[]): void {
    for (const v of voluntarios) {
      // ─── Header del voluntario ────────────────────────────────────────────
      const hRow = sheet.addRow([`VOLUNTARIO: ${v.nombre ?? '(Sin nombre)'}`]);
      sheet.mergeCells(`A${hRow.number}:E${hRow.number}`);
      hRow.getCell(1).font = { size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      hRow.getCell(1).alignment = { vertical: 'middle' };
      hRow.height = 20;

      // ─── Datos del voluntario ─────────────────────────────────────────────
      const infoRow = sheet.addRow([
        `Nacionalidad: ${v.nacionalidad ?? '-'}`,
        `Email: ${v.email ?? '-'}`,
        `Entrada: ${this.formatDate(v.fechaEntrada)}`,
        `Salida: ${v.fechaSalida ? this.formatDate(v.fechaSalida) : 'En curso'}`,
        `ONG: ${v.ong ?? '-'}`,
      ]);
      infoRow.font = { color: { argb: '444444' } };

      sheet.addRow([]);

      // ─── Programas asignados ───────────────────────────────────────────────
      const progLabelRow = sheet.addRow(['PROGRAMAS ASIGNADOS']);
      progLabelRow.getCell(1).font = { bold: true, color: { argb: '003366' } };

      const programasAsignados: any[] = v.programas ?? [];
      if (programasAsignados.length > 0) {
        const progHeaderRow = sheet.addRow(['Programa', 'Lugar', 'Horas totales', 'Pago realizado', 'Origen']);
        progHeaderRow.eachCell((cell) => {
          cell.font = { bold: true };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbe8f5' } };
        });
        for (const pa of programasAsignados) {
          sheet.addRow([
            pa.programa?.nombre ?? '-',
            pa.programa?.lugar ?? '-',
            pa.horasTotales ?? 0,
            pa.pagoRealizado != null ? (pa.pagoRealizado ? 'Sí' : 'No') : '-',
            pa.origen ?? '-',
          ]);
        }
      } else {
        sheet.addRow(['Sin programas asignados']);
      }

      sheet.addRow([]);
      sheet.addRow([]);
    }

    sheet.columns = [
      { width: 38 },
      { width: 30 },
      { width: 16 },
      { width: 18 },
      { width: 20 },
    ];
  }

  private addContabilidadPorCuentaSheet(sheet: ExcelJS.Worksheet, cuentas: any[]): void {
    for (const cuenta of cuentas) {
      // ─── Header de cuenta ────────────────────────────────────────────────
      const hRow = sheet.addRow([`CUENTA: ${cuenta.nombre}  (${cuenta.codigo})`]);
      sheet.mergeCells(`A${hRow.number}:F${hRow.number}`);
      hRow.getCell(1).font = { size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
      hRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF003366' } };
      hRow.getCell(1).alignment = { vertical: 'middle' };
      hRow.height = 22;

      // ─── Metadata ────────────────────────────────────────────────────────
      const metaRow = sheet.addRow([
        'Área:', cuenta.areaNombre,
        'Moneda:', cuenta.monedaBase,
        'Estado:', cuenta.activa ? 'Activa' : 'Archivada',
      ]);
      metaRow.getCell(1).font = { bold: true };
      metaRow.getCell(3).font = { bold: true };
      metaRow.getCell(5).font = { bold: true };
      metaRow.getCell(6).font = { bold: true, color: { argb: cuenta.activa ? 'FF1a7a3b' : 'FFcc2200' } };

      sheet.addRow([]);

      // ─── Resumen financiero ──────────────────────────────────────────────
      const finLabelRow = sheet.addRow(['RESUMEN FINANCIERO']);
      finLabelRow.getCell(1).font = { bold: true, color: { argb: '003366' } };

      const finHeaderRow = sheet.addRow([
        'Presupuesto asignado', 'Ingresos (acumulado)', 'Egresos (acumulado)', 'Fondos disponibles',
      ]);
      finHeaderRow.eachCell((cell) => {
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFdbe8f5' } };
      });

      const t = cuenta.totales;
      const finValRow = sheet.addRow([
        this.formatMoney(t.presupuestoAsignado, cuenta.monedaBase),
        this.formatMoney(t.ingresos, cuenta.monedaBase),
        this.formatMoney(t.egresos, cuenta.monedaBase),
        this.formatMoney(t.disponible, cuenta.monedaBase),
      ]);
      finValRow.getCell(2).font = { color: { argb: '1a7a3b' } };
      finValRow.getCell(3).font = { color: { argb: 'cc2200' } };
      finValRow.getCell(4).font = { bold: true, color: { argb: t.disponible >= 0 ? '1a7a3b' : 'cc2200' } };

      sheet.addRow([]);

      // ─── Proyectos ───────────────────────────────────────────────────────
      const projLabelRow = sheet.addRow(['PROYECTOS VINCULADOS']);
      projLabelRow.getCell(1).font = { bold: true, color: { argb: '003366' } };

      if (cuenta.proyectos.length > 0) {
        const projHeaderRow = sheet.addRow(['Proyecto', 'Estado', 'Presupuesto', 'Moneda']);
        projHeaderRow.eachCell((cell) => { cell.font = { bold: true }; });
        for (const p of cuenta.proyectos) {
          sheet.addRow([
            p.title,
            this.traducirEstado(p.status),
            p.presupuestoTotal != null ? this.formatMoney(p.presupuestoTotal, p.monedaPresupuesto) : 'Sin presupuesto',
            p.monedaPresupuesto ?? '-',
          ]);
        }
      } else {
        sheet.addRow(['Sin proyectos vinculados']);
      }

      sheet.addRow([]);

      // ─── Programas ───────────────────────────────────────────────────────
      const progLabelRow = sheet.addRow(['PROGRAMAS VINCULADOS']);
      progLabelRow.getCell(1).font = { bold: true, color: { argb: '003366' } };

      if (cuenta.programas.length > 0) {
        const progHeaderRow = sheet.addRow(['Programa', 'Presupuesto', 'Moneda']);
        progHeaderRow.eachCell((cell) => { cell.font = { bold: true }; });
        for (const p of cuenta.programas) {
          sheet.addRow([
            p.nombre,
            p.presupuestoTotal != null ? this.formatMoney(p.presupuestoTotal, p.monedaPresupuesto) : 'Sin presupuesto',
            p.monedaPresupuesto ?? '-',
          ]);
        }
      } else {
        sheet.addRow(['Sin programas vinculados']);
      }

      sheet.addRow([]);

      // ─── Movimientos del período ─────────────────────────────────────────
      const txs: any[] = cuenta.transacciones ?? [];
      const txLabelRow = sheet.addRow([`MOVIMIENTOS DEL PERÍODO (${txs.length})`]);
      txLabelRow.getCell(1).font = { bold: true, color: { argb: '003366' } };

      if (txs.length > 0) {
        const txHeaderRow = sheet.addRow(['Fecha', 'Tipo', 'Categoría', 'Monto', 'Descripción']);
        txHeaderRow.eachCell((cell) => { cell.font = { bold: true }; });
        for (const tx of txs) {
          sheet.addRow([
            this.formatDate(tx.fecha),
            tx.tipo,
            tx.categoria ?? '-',
            this.formatMoney(tx.monto, tx.moneda),
            tx.descripcion ?? '-',
          ]);
        }
      } else {
        sheet.addRow(['Sin movimientos en el período seleccionado']);
      }

      sheet.addRow([]);
      sheet.addRow([]);
    }

    sheet.columns = [
      { width: 42 },
      { width: 28 },
      { width: 28 },
      { width: 28 },
      { width: 30 },
      { width: 20 },
    ];
  }

  private formatDate(v: any): string {
    try {
      const d = v instanceof Date ? v : new Date(v);
      return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('es-CR');
    } catch {
      return '-';
    }
  }

  private formatMoney(v: any, currency?: string): string {
    if (v == null) return '-';
    const n = typeof v === 'object' && 'toNumber' in v ? (v as any).toNumber() : Number(v);
    if (isNaN(n)) return String(v);
    const curr = (currency ?? '').toUpperCase() || (n >= 10000 ? 'CRC' : 'USD');
    const locale = curr === 'USD' ? 'en-US' : curr === 'EUR' ? 'es-ES' : 'es-CR';
    const symbol = curr === 'USD' ? '$' : curr === 'EUR' ? '€' : '₡';
    const formatted = n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol} ${formatted} ${curr}`;
  }

  private stringifyValue(v: any): string {
    if (v == null) return '-';
    if (v instanceof Date) return this.formatDate(v);
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    if (Array.isArray(v)) return v.join(', ');
    if (typeof v === 'object') return Object.values(v).join(' | ');
    return String(v);
  }

  private traducirEstado(valor: string): string {
  if (!valor) return '-';
  const map: Record<string, string> = {
    PAID: 'Pagado',
    PENDING: 'Pendiente',
    APPROVED: 'Aprobado',
    REJECTED: 'Rechazado',
    CANCELLED: 'Cancelado',
    IN_PROGRESS: 'En proceso',
    COMPLETED: 'Completado',
    ACTIVE: 'Activo',
    INACTIVE: 'Inactivo',
    OPEN: 'Abierto',
    CLOSED: 'Cerrado',
    VALIDATED: 'Validada',
    VALIDADA: 'Validada',
  };
  return map[valor.toUpperCase()] ?? valor;
}

}

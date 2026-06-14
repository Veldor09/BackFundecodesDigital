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
    const { periodo, anio, fechaInicio, fechaFin, tipoReporte, modulos } = filtros;
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

    for (const modulo of modulosArray) {
      const data = await this.obtenerDatosModulo(modulo, start, end);
      const agrupado = this.agruparPorPeriodo(data, tipoReporte);
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

  private async obtenerDatosModulo(modulo: string, start: Date, end: Date) {
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
        const txs = await this.prisma.transaccion.findMany({
          where: { fecha: { gte: start, lte: end } },
          include: {
            project: { select: { id: true, title: true } },
          },
          orderBy: { fecha: 'asc' },
        });
        // Agregar nombre del proyecto como campo plano para el PDF
        return txs.map((t) => ({
          ...t,
          proyectoNombre: (t as any).project?.title ?? t.programa ?? '-',
          montoNum: typeof t.monto === 'object' && 'toNumber' in (t.monto as any)
            ? (t.monto as any).toNumber()
            : Number(t.monto ?? 0),
        }));
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
  const HEADER_H = 80;
  const BRAND = '#003366';

  const doc = new PDFDocument({ margin: MARGIN, size: 'A4', bufferPages: true });
  const buffers: Uint8Array[] = [];
  doc.on('data', (chunk) => buffers.push(chunk));

  const fechaGeneracion = new Date().toLocaleString('es-CR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // ===== ENCABEZADO INSTITUCIONAL =====
  // Barra azul de fondo
  doc.save();
  doc.rect(0, 0, PAGE_W, HEADER_H).fill(BRAND);
  doc.restore();

  // Logo (si existe)
  let logoLoaded = false;
  if (fs.existsSync(LOGO_PATH)) {
    try {
      doc.image(LOGO_PATH, MARGIN, 12, { height: 54, fit: [100, 54] });
      logoLoaded = true;
    } catch { /* sin logo */ }
  }

  const textStartX = logoLoaded ? MARGIN + 108 : MARGIN;

  doc.font('Helvetica-Bold').fontSize(16).fillColor('white')
    .text('FUNDECODES DIGITAL', textStartX, 20, { align: 'left' });
  doc.font('Helvetica').fontSize(10).fillColor('#cce0f5')
    .text('Sistema Administrativo de Gestión', textStartX, 42);
  doc.font('Helvetica').fontSize(8).fillColor('#aaccee')
    .text('Informe Consolidado de Gestión', textStartX, 56);

  // Fecha en esquina derecha del header
  doc.font('Helvetica').fontSize(8).fillColor('#cce0f5')
    .text(`Generado: ${fechaGeneracion}`, MARGIN, 56, { align: 'right', width: PAGE_W - MARGIN * 2 });

  // Línea divisora bajo el header
  doc.moveTo(0, HEADER_H).lineTo(PAGE_W, HEADER_H).strokeColor('#002244').lineWidth(1.5).stroke();

  doc.moveDown(0);
  doc.y = HEADER_H + 20;

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
    doc.text(`   • ${nombre}: ${detalle.total} registro${detalle.total !== 1 ? 's' : ''}`, { indent: 8 });
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
      { key: 'tipoDocumento', label: 'Tipo doc.', width: 80 },
      { key: 'numeroDocumento', label: 'N° documento', width: 100 },
      { key: 'nombreCompleto', label: 'Nombre completo', width: 145 },
      { key: 'email', label: 'Email', width: 140 },
      { key: 'telefono', label: 'Teléfono', width: 80 },
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

    doc.moveDown(1);
    doc.fontSize(13).fillColor(BRAND).font('Helvetica-Bold')
      .text(nombreModulo, MARGIN, doc.y, { underline: true, width: PAGE_W - MARGIN * 2 });
    doc.moveDown(0.4);
    doc.fontSize(9).fillColor('#555').font('Helvetica')
      .text(`Total de registros en este módulo: ${items.length}`, MARGIN);
    doc.moveDown(0.5);

    // Resumen financiero para Contabilidad
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

  // ===== PIE DE PÁGINA =====
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    const bottomY = doc.page.height - 38;
    // Línea separadora
    doc.moveTo(MARGIN, bottomY - 6).lineTo(PAGE_W - MARGIN, bottomY - 6)
      .strokeColor('#cccccc').lineWidth(0.4).stroke();
    doc.fontSize(8).fillColor('gray').font('Helvetica')
      .text('FUNDECODES DIGITAL – Sistema Administrativo · Documento de uso institucional',
        MARGIN, bottomY, { width: PAGE_W - MARGIN * 2 - 80 });
    doc.text(`Página ${i + 1} de ${pageRange.count}`,
      PAGE_W - MARGIN - 80, bottomY, { width: 80, align: 'right' });
  }

  doc.end();
  await new Promise((resolve) => doc.on('end', resolve));
  return Buffer.concat(buffers);
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

private labelModulo(modulo: string): string {
  const map: Record<string, string> = {
    projects: 'Proyectos',
    billing: 'Facturación',
    collaborators: 'Colaboradores',
    volunteers: 'Voluntarios',
    solicitudes: 'Solicitudes de compra',
    programas: 'Programas de voluntariado',
    sanciones: 'Sanciones disciplinarias',
    contabilidad: 'Contabilidad (transacciones)',
    visitaciones: 'Visitación',
    areas: 'Áreas de trabajo',
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
  const marginBottom = 70;
  const maxY = doc.page.height - marginBottom;
  let y = doc.y;

  let totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  if (totalWidth > maxTableWidth) {
    const scale = maxTableWidth / totalWidth;
    columns = columns.map((c) => ({ ...c, width: Math.floor(c.width * scale) }));
    totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  }

  const startX = Math.max((pageWidth - totalWidth) / 2, pageMargin);

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
  }

  doc.y = Math.min(y + 10, maxY - 10);
}

async generarExcel(data: any): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Informe General');

  // ===== ENCABEZADO GENERAL =====
  sheet.mergeCells('A1', 'E1');
  const title = sheet.getCell('A1');
  title.value = 'FUNDECODES DIGITAL - Informe Consolidado de Gestión';
  title.font = { size: 16, bold: true, color: { argb: '003366' } };
  title.alignment = { horizontal: 'center' };

  sheet.addRow([]);
  sheet.addRow(['Fecha de generación:', new Date().toLocaleString('es-CR')]);
  sheet.addRow(['Total general:', data.totalRegistros]);
  sheet.addRow([]);

  // ===== RESUMEN GENERAL =====
  sheet.addRow(['Resumen General']);
  const resumenRow = sheet.lastRow;
  if (resumenRow) resumenRow.font = { bold: true, size: 12, color: { argb: '003366' } };

  sheet.addRow(['Módulo', 'Total de registros']);
  const headerRow = sheet.lastRow;
  if (headerRow) {
    headerRow.font = { bold: true };
    headerRow.alignment = { horizontal: 'center' };
  }

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
      : modulo.charAt(0).toUpperCase() + modulo.slice(1);

    sheet.addRow([nombreModulo, detalle.total]);
  }

  sheet.addRow([]);
  sheet.addRow(['Total general', data.totalRegistros]);
  const totalRow = sheet.lastRow;
  if (totalRow) totalRow.font = { bold: true };

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
      : modulo.toUpperCase();

    // Nueva hoja para el módulo
    const moduloSheet = workbook.addWorksheet(nombreModulo);

    moduloSheet.mergeCells('A1', 'F1');
    const header = moduloSheet.getCell('A1');
    header.value = `Módulo: ${nombreModulo}`;
    header.font = { size: 14, bold: true, color: { argb: '003366' } };
    header.alignment = { horizontal: 'center' };

    moduloSheet.addRow([]);

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
        { key: 'tipoDocumento', label: 'Tipo Documento' },
        { key: 'numeroDocumento', label: 'Número Documento' },
        { key: 'nombreCompleto', label: 'Nombre Completo' },
        { key: 'email', label: 'Email' },
        { key: 'telefono', label: 'Teléfono' },
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
    } else {
      columnas = Object.keys(items[0] || {}).slice(0, 6).map((key) => ({
        key,
        label: key.charAt(0).toUpperCase() + key.slice(1),
      }));
    }

    // ===== Encabezados =====
    moduloSheet.addRow(columnas.map((c) => c.label));
    const headerRow2 = moduloSheet.lastRow;
    if (headerRow2) headerRow2.font = { bold: true, color: { argb: '003366' } };

    // ===== Filas =====
    for (const item of items) {
      const row = columnas.map((col) => {
        let val = item[col.key];

        // ✅ Traducir estados (estado o status)
        if (
          typeof val === 'string' &&
          (col.key.toLowerCase().includes('estado') || col.key.toLowerCase().includes('status'))
        ) {
          return this.traducirEstado(val);
        }

        // ✅ Formatear montos
        if (col.key.toLowerCase() === 'amount' && val != null) {
          return this.formatMoney(val);
        }

        // ✅ Formatear fechas
        if (val instanceof Date) return this.formatDate(val);

        if (val == null || val === '') return '-';
        return String(val);
      });

      moduloSheet.addRow(row);
    }

    // ===== Ajuste de columnas =====
    moduloSheet.columns = columnas.map(() => ({ width: 20 }));
    const thirdRow = moduloSheet.getRow(3);
    if (thirdRow) thirdRow.alignment = { horizontal: 'center' };
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

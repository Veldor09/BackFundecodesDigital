import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FiltroInformeDto, TipoPeriodo } from './dto/filtro-informe.dto';
import PDFDocument = require('pdfkit');
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';
import { StorageService } from 'src/common/services/storage.service';
import { AuditService } from 'src/common/services/audit.service';

@Injectable()
export class ReportesService {
 constructor(
  private prisma: PrismaService,
  private storage: StorageService,
  private audit: AuditService,
) {}


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

  /**
 * 📦 Obtiene los registros de un módulo según el rango de fechas
 */
private async obtenerDatosModulo(modulo: string, start: Date, end: Date) {
  const key = modulo.toLowerCase().trim();

  try {
    if (['project', 'projects'].includes(key)) {
      return this.prisma.project.findMany({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    if (['billing', 'facturacion'].includes(key)) {
      return this.prisma.billingRequest.findMany({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    if (['solicitud', 'solicitudes'].includes(key)) {
      return this.prisma.solicitudCompra.findMany({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    if (['collaborator', 'collaborators', 'colaborador', 'colaboradores'].includes(key)) {
      return this.prisma.collaborator.findMany({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    if (['volunteer', 'volunteers', 'voluntario', 'voluntarios'].includes(key)) {
      const repo: any =
        (this.prisma as any).volunteer ?? (this.prisma as any).voluntario;
      if (!repo) return [];
      return repo.findMany({
        where: { createdAt: { gte: start, lte: end } },
      });
    }

    return [];
  } catch (error) {
    console.error(`❌ Error obteniendo datos del módulo "${modulo}":`, error);
    return [];
  }
}



// ============================================================
// ✅ MÉTODO CORREGIDO: guardar reporte y auditar
// ============================================================
async guardarReporteYAuditar(
  formato: 'pdf' | 'excel',
  buffer: Buffer,
  userId: number,
  parametros?: any,
  projectId?: number, // 👈 lo hacemos opcional, no obligatorio
) {
  try {
    const nombreArchivo = `informe-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.${formato}`;

    // === 1️⃣ Guardar el archivo físico ===
    const saved = await this.storage.saveFile(buffer, nombreArchivo);

    // === 2️⃣ Preparar datos del registro ===
    const data: any = {
      filename: nombreArchivo,
      url: saved.url,
      mime: saved.mime,
      bytes: saved.bytes,
      uploadedAt: new Date(),
    };

    // === 3️⃣ Asociar un proyecto si existe ===
    if (projectId) {
      data.project = { connect: { id: projectId } };
    }

    // === 4️⃣ Guardar en base de datos ===
    const reporte = await this.prisma.receipt.create({ data });

    // === 5️⃣ Registrar acción de auditoría ===
    await this.audit.registrarAccion({
      userId,
      accion: `GENERAR_INFORME_${formato.toUpperCase()}`,
      detalle: `Archivo guardado: ${nombreArchivo}`,
    });

    // === 6️⃣ Retornar resultado ===
    return { ok: true, reporte };
  } catch (err: unknown) {
  const error = err as Error;
  console.error('❌ ERROR EN guardarReporteYAuditar:');
  console.error('Mensaje:', error.message);
  console.error('Stack:', error.stack);
  console.error('Detalles completos:', err);

  throw new Error(`No se pudo generar y guardar el informe: ${error.message}`);
}

}




// ============================================
// === NUEVO MÉTODO: generar, guardar y auditar ===
// ============================================
async generarGuardarAuditar(
  formato: 'pdf' | 'excel',
  informeData: any,
  userId: number,
  projectId?: number,
): Promise<{
  ok: boolean;
  buffer: Buffer;
  filename: string;
  reporte: any;
}> {
  try {
    console.log('🟡 [1] Iniciando generación del informe');

    // === 1️⃣ Generar archivo en memoria ===
    let buffer: Buffer;
    let mime: string;
    let extension: string;

    if (formato === 'pdf') {
      console.log('📄 Generando PDF...');
      buffer = await this.generarPdf(informeData);
      mime = 'application/pdf';
      extension = 'pdf';
    } else {
      console.log('📊 Generando Excel...');
      buffer = await this.generarExcel(informeData);
      mime =
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      extension = 'xlsx';
    }

    console.log('✅ Archivo generado en memoria');

    // === 2️⃣ Guardar en almacenamiento ===
    const nombreArchivo = `informe-fundecodes-${new Date()
      .toISOString()
      .replace(/[:.]/g, '-')}.${extension}`;

    console.log('🟢 Guardando archivo:', nombreArchivo);
    const saved = await this.storage.saveFile(buffer, nombreArchivo);
    console.log('✅ Archivo guardado:', saved);

    // === 3️⃣ Registrar en la base de datos ===
    console.log('🟢 Registrando en la base de datos...');

    const data: any = {
      filename: saved.filename,
      url: saved.url,
      mime: saved.mime || mime,
      bytes: saved.bytes,
      uploadedAt: new Date(),
      updatedAt: new Date(),
    };

    // === 3.1️⃣ Verificar usuario y conectar ===
    let usuario: { name?: string | null; email?: string | null } | null = null;

    if (userId && !isNaN(userId)) {
      const usuarioExiste = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true, email: true },
      });

      if (usuarioExiste) {
        data.user = { connect: { id: userId } };
        usuario = usuarioExiste;
        const nombreVisible =
          usuario.name && usuario.name.trim() !== ''
            ? usuario.name
            : usuario.email;
        console.log(`👤 Asociado al usuario: ${nombreVisible || 'Desconocido'}`);
      } else {
        console.warn(`⚠️ Usuario con id=${userId} no existe, se omite asignación.`);
      }
    } else {
      console.warn('⚠️ userId inválido o ausente, se omite asociación de usuario.');
    }

    // === 3.2️⃣ Verificar proyecto y conectar ===
    if (projectId && !isNaN(projectId)) {
      const proyectoExiste = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { id: true },
      });

      if (proyectoExiste) {
        data.project = { connect: { id: projectId } };
        console.log(`📁 Asociado al proyecto ID: ${projectId}`);
      } else {
        console.warn(`⚠️ Proyecto con id=${projectId} no existe, se omite asignación.`);
      }
    }

    // === 3.3️⃣ Crear registro en Receipt ===
    const reporte = await this.prisma.receipt.create({ data });
    console.log('✅ Registro creado en Receipt:', reporte);

    // === 4️⃣ Registrar acción en auditoría ===
    console.log('🟢 Registrando auditoría...');
    await this.audit.registrarAccion({
      userId,
      accion: `GENERAR_INFORME_${formato.toUpperCase()}`,
      detalle: `Archivo generado: ${nombreArchivo}`,
    });

    console.log('✅ Auditoría registrada');

    // === 5️⃣ Enriquecer datos para PDF con usuario/fecha ===
    const informeConUsuario = {
      ...informeData,
      generadoPor: usuario?.name || usuario?.email || 'Usuario desconocido',
      fechaGeneracion: new Date(),
    };

    // Si el formato es PDF, regenerar con los datos del usuario
    if (formato === 'pdf') {
      buffer = await this.generarPdf(informeConUsuario);
      console.log('📄 PDF regenerado con información del usuario.');
    }

    console.log('✅ Informe generado, guardado y auditado correctamente.');
    return { ok: true, buffer, filename: nombreArchivo, reporte };
  } catch (err: any) {
    console.error('❌ ERROR DETECTADO EN generarGuardarAuditar:', err);
    throw new Error('No se pudo generar y guardar el informe.');
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
  const doc = new PDFDocument({ margin: 65, size: 'A4', bufferPages: true });
  const buffers: Uint8Array[] = [];
  doc.on('data', buffers.push.bind(buffers));

  const fechaGeneracion = new Date().toLocaleString('es-CR', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  // ===== ENCABEZADO =====
  doc.fontSize(18).fillColor('#003366').text('FUNDECODES DIGITAL', { align: 'center' }).moveDown(0.3);
  doc.fontSize(14).fillColor('#000').text('INFORME CONSOLIDADO DE GESTIÓN', { align: 'center' }).moveDown(1);
  doc.fontSize(10).fillColor('gray').text(`Generado el: ${fechaGeneracion}`, { align: 'right' }).moveDown(1.5);

  const { filtros, totalRegistros, detalles } = data;

  doc.fontSize(12).fillColor('#003366').font('Helvetica-Bold').text('Resumen General', 70, doc.y);
  doc.moveDown(0.8);
  doc.fontSize(10).fillColor('#003366').font('Helvetica-Bold');
  doc.text('Periodo analizado:', 70, doc.y, { continued: true });
  doc.font('Helvetica').fillColor('#000').text(
    filtros.periodo === 'ANIO'
      ? filtros.anio
      : `${this.formatDate(filtros.fechaInicio)} a ${this.formatDate(filtros.fechaFin)}`
  );
  doc.font('Helvetica-Bold').fillColor('#003366').text('Tipo de reporte:', 70, doc.y, { continued: true });
  doc.font('Helvetica').fillColor('#000').text(filtros.tipoReporte);
  doc.font('Helvetica-Bold').fillColor('#003366').text('Módulos incluidos:', 70);
  doc.moveDown(0.3);
  doc.font('Helvetica').fillColor('#000');
  for (const [modulo, detalle] of Object.entries<any>(detalles)) {
    const nombreModulo =
      modulo === 'billing'
        ? 'Facturación'
        : modulo === 'collaborators'
        ? 'Colaboradores'
        : modulo === 'volunteers'
        ? 'Voluntarios'
        : modulo === 'solicitudes'
        ? 'Solicitudes'
        : modulo.charAt(0).toUpperCase() + modulo.slice(1);
    doc.text(`   • ${nombreModulo}: ${detalle.total} registro${detalle.total !== 1 ? 's' : ''}`);
  }
  doc.moveDown(0.6);
  doc.font('Helvetica-Bold').fillColor('#003366').text('Total general:', 70, doc.y, { continued: true });
  doc.font('Helvetica').fillColor('#000').text(`${totalRegistros} registro${totalRegistros !== 1 ? 's' : ''}`);
  doc.moveDown(1);
  doc.moveTo(70, doc.y).lineTo(530, doc.y).strokeColor('#cccccc').stroke();
  doc.moveDown(1.5);

  // ===== DETALLES POR MÓDULO =====
  const config = {
    projects: [
      { key: 'id', label: 'ID', width: 35 },
      { key: 'title', label: 'Título', width: 110 },
      { key: 'place', label: 'Lugar', width: 110 },
      { key: 'area', label: 'Área', width: 100 },
      { key: 'status', label: 'Estado', width: 70 },
      { key: 'createdAt', label: 'Creado', width: 70, format: (v) => this.formatDate(v) },
    ],
    billing: [
      { key: 'id', label: 'ID', width: 35 },
      { key: 'amount', label: 'Monto', width: 90, format: (v) => this.formatMoney(v) },
      { key: 'concept', label: 'Concepto', width: 150 },
      { key: 'status', label: 'Estado', width: 80, format: (v) => this.traducirEstado(v) },
      { key: 'createdAt', label: 'Fecha', width: 80, format: (v) => this.formatDate(v) },
    ],
    solicitudes: [
      { key: 'id', label: 'ID', width: 35 },
      { key: 'titulo', label: 'Título', width: 120 },
      { key: 'estado', label: 'Estado', width: 80 },
      { key: 'estadoContadora', label: 'Contadora', width: 90 },
      { key: 'estadoDirector', label: 'Director', width: 90 },
      { key: 'createdAt', label: 'Creada', width: 80, format: (v) => this.formatDate(v) },
    ],
    collaborators: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'nombreCompleto', label: 'Nombre completo', width: 140 },
      { key: 'correo', label: 'Correo', width: 130 },
      { key: 'cedula', label: 'Cédula', width: 80 },
      { key: 'telefono', label: 'Teléfono', width: 80 },
    ],
    volunteers: [
      { key: 'id', label: 'ID', width: 30 },
      { key: 'tipoDocumento', label: 'Tipo documento', width: 110 },
      { key: 'numeroDocumento', label: 'Número documento', width: 120 },
      { key: 'nombreCompleto', label: 'Nombre completo', width: 130 },
      { key: 'email', label: 'Email', width: 150 },
      { key: 'telefono', label: 'Teléfono', width: 90 },
    ],
  };

  let primerModulo = true;
  for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
    const items = detalle.items || [];
    if (items.length === 0) continue;

    if (primerModulo) {
      doc.addPage();
      primerModulo = false;
    } else if (doc.y > doc.page.height - 150) {
      doc.addPage();
    }

    const nombreModulo =
  modulo === 'projects'
    ? 'PROYECTOS'
    : modulo === 'billing'
    ? 'FACTURACIÓN'
    : modulo === 'collaborators'
    ? 'COLABORADORES'
    : modulo === 'volunteers'
    ? 'VOLUNTARIOS'
    : modulo === 'solicitudes'
    ? 'SOLICITUDES'
    : modulo.toUpperCase();

    doc.moveDown(1.2);
    doc.fontSize(14).fillColor('#003366').text(nombreModulo, 65, doc.y, {
      underline: true,
      align: 'left',
      width: 470,
    }).moveDown(0.6);

    const cols =
      config[modulo] ??
      Object.keys(items[0] || {})
        .slice(0, 6)
        .map((k) => ({ key: k, label: k.toUpperCase(), width: 80 }));

    this.drawTableStable(doc, cols, items);
    doc.moveDown(0.8);
    doc.moveTo(65, doc.y).lineTo(530, doc.y).strokeColor('#cccccc').stroke();
  }

        // ===== PIE DE PÁGINA =====
  const pageRange = doc.bufferedPageRange();
  for (let i = 0; i < pageRange.count; i++) {
    doc.switchToPage(i);
    const bottomY = doc.page.height - 50;
    doc.fontSize(9).fillColor('gray')
      .text('FUNDECODES DIGITAL – Sistema Administrativo', 0, bottomY, { align: 'center' });
    doc.text(`Página ${i + 1} de ${pageRange.count}`, 0, bottomY + 12, { align: 'center' });
  }

  // 🧹 Cierre limpio sin páginas vacías
  doc.end();

  await new Promise((resolve) => doc.on('end', resolve));
  const finalBuffer = Buffer.concat(buffers);

  // 🧩 Eliminar páginas vacías detectando secciones sin texto visible
  const pdfStr = finalBuffer.toString('latin1');
  const cleaned = pdfStr
    // elimina páginas vacías con sólo pie o resources
    .replace(/\/Type\s*\/Page[\s\S]{0,600}?(?=(?:\/Type\s*\/Page)|%%EOF)/g, (match) => {
      const noText = !/Tj|TJ|Tf|Td/.test(match); // no hay texto real
      return noText ? '' : match;
    });

  return Buffer.from(cleaned, 'latin1');
}







  private drawTableStable(
  doc: PDFKit.PDFDocument,
  columns: { key: string; label: string; width: number; format?: (v: any) => string }[],
  rows: any[],
) {
  const pageWidth = doc.page.width;
  const pageMargin = 65;
  const maxTableWidth = 500;
  const headerHeight = 24;
  const baseRowHeight = 24;
  const marginBottom = 70;
  const maxY = doc.page.height - marginBottom;
  let y = doc.y;

  let totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  if (totalWidth > maxTableWidth) {
    const scale = maxTableWidth / totalWidth;
    columns = columns.map((c) => ({ ...c, width: c.width * scale }));
    totalWidth = maxTableWidth;
  }

  const startX = Math.max((pageWidth - totalWidth) / 2, pageMargin);

  const drawHeader = () => {
    doc.save().rect(startX, y, totalWidth, headerHeight).fill('#dbe8f5').restore();
    let x = startX + 8;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#003366');
    for (const col of columns) {
      const labelY = y + (headerHeight - doc.heightOfString(col.label, { width: col.width - 10 })) / 2 - 1;
      doc.text(col.label, x, labelY, { width: col.width - 10, align: 'left' });
      x += col.width;
    }
    y += headerHeight + 6;
  };

  drawHeader();

  doc.font('Helvetica').fontSize(9).fillColor('#000');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const heights = columns.map((col) => {
      const val = col.format ? col.format(row[col.key]) : this.stringifyValue(row[col.key]);
      return Math.max(doc.heightOfString(val, { width: col.width - 10 }) + 8, baseRowHeight);
    });
    const rowHeight = Math.max(...heights);

    // 🔹 Evitar agregar páginas vacías
    const isLastRow = i === rows.length - 1;
    if (y + rowHeight > maxY && !isLastRow) {
      doc.addPage();
      y = 70;
      drawHeader();
    }

    // Fondo alternado
    if (i % 2 === 1) doc.save().rect(startX, y, totalWidth, rowHeight).fill('#f7f9fb').restore();

    let x = startX + 8;
    for (const col of columns) {
      const val = col.format ? col.format(row[col.key]) : this.stringifyValue(row[col.key]);
      doc.fillColor('#000').text(val, x, y + 5, {
        width: col.width - 10,
        align: 'left',
        lineBreak: true,
      });
      x += col.width;
    }

    doc.moveTo(startX, y + rowHeight)
      .lineTo(startX + totalWidth, y + rowHeight)
      .strokeColor('#e0e0e0')
      .stroke();

    y += rowHeight;
  }

  doc.y = Math.min(y + 12, maxY - 10);
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
      modulo === 'projects'
        ? 'Proyectos'
        : modulo === 'billing'
        ? 'Facturación'
        : modulo === 'collaborators'
        ? 'Colaboradores'
        : modulo === 'volunteers'
        ? 'Voluntarios'
        : modulo === 'solicitudes'
        ? 'Solicitudes'
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
      modulo === 'projects'
        ? 'PROYECTOS'
        : modulo === 'billing'
        ? 'FACTURACIÓN'
        : modulo === 'collaborators'
        ? 'COLABORADORES'
        : modulo === 'volunteers'
        ? 'VOLUNTARIOS'
        : modulo === 'solicitudes'
        ? 'SOLICITUDES'
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
    const curr = currency?.toUpperCase() ?? (n <= 10000 ? 'USD' : 'CRC');
    const locale = curr === 'USD' ? 'en-US' : 'es-CR';
    const formatted = n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${curr} ${formatted}`;
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

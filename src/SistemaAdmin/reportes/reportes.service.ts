import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FiltroInformeDto, TipoPeriodo, TipoReporte } from './dto/filtro-informe.dto';
import PDFDocument = require('pdfkit'); // ✅ CORRECTO para evitar error TS2351
import * as ExcelJS from 'exceljs';
import { Buffer } from 'buffer';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  /* ============================================================
     📊 Generar datos del informe
  ============================================================ */
  async generarInforme(filtros: FiltroInformeDto) {
    const { periodo, anio, fechaInicio, fechaFin, tipoReporte, modulos } = filtros;

    // 🔒 Validaciones básicas
    if (periodo === TipoPeriodo.ANIO && !anio) {
      throw new BadRequestException('Debe especificar el año del informe.');
    }
    if (periodo === TipoPeriodo.RANGO && (!fechaInicio || !fechaFin)) {
      throw new BadRequestException('Debe indicar fechaInicio y fechaFin.');
    }

    // 🗓️ Determinar rango de fechas
    const { start, end } =
      periodo === TipoPeriodo.ANIO
        ? { start: new Date(`${anio}-01-01`), end: new Date(`${anio}-12-31T23:59:59.999Z`) }
        : { start: new Date(fechaInicio!), end: new Date(fechaFin!) };

    const detalles: Record<string, any> = {};
    let totalGlobal = 0;

    // 🔁 Recorrer módulos seleccionados
    for (const modulo of modulos) {
      const data = await this.obtenerDatosModulo(modulo, start, end);
      const agrupado = this.agruparPorPeriodo(data, tipoReporte);
      detalles[modulo] = {
        total: data.length,
        grupos: agrupado,
      };
      totalGlobal += data.length;
    }

    // 📦 Retornar estructura del informe
    return {
      filtros,
      totalRegistros: totalGlobal,
      fechaGeneracion: new Date(),
      detalles,
    };
  }

  /* ============================================================
     📂 Obtener datos desde Prisma por módulo
  ============================================================ */
  private async obtenerDatosModulo(modulo: string, start: Date, end: Date) {
    switch (modulo) {
      case 'projects':
        return this.prisma.project.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      case 'billing':
        return this.prisma.billingRequest.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      case 'contabilidad':
        return this.prisma.transaccion.findMany({
          where: { fecha: { gte: start, lte: end } },
        });
      case 'collaborator':
        return this.prisma.collaborator.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      case 'solicitudes':
        return this.prisma.solicitudCompra.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      case 'volunteer':
        return this.prisma.voluntario.findMany({
          where: { createdAt: { gte: start, lte: end } },
        });
      default:
        return [];
    }
  }

  /* ============================================================
     🧩 Agrupar datos por periodo temporal
  ============================================================ */
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
        case 'Cuatrimestral':
          clave = `Cuatrimestre ${Math.ceil((fecha.getMonth() + 1) / 4)}`;
          break;
        case 'Semestral':
          clave = `Semestre ${fecha.getMonth() < 6 ? '1' : '2'}`;
          break;
        case 'Anual':
          clave = 'Año completo';
          break;
        default:
          clave = 'General';
      }

      grupos[clave] = (grupos[clave] || 0) + 1;
    }
    return grupos;
  }

  /* ============================================================
     🧾 Generar PDF institucional FUNDECODES
  ============================================================ */
  async generarPdf(data: any): Promise<Buffer> {
    const doc = new PDFDocument({ margin: 50 });
    const buffers: Uint8Array[] = [];

    doc.on('data', buffers.push.bind(buffers));
    const fechaGeneracion = new Date().toLocaleString('es-CR', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

    // === Encabezado institucional ===
    doc
      .fontSize(18)
      .fillColor('#003366')
      .text('FUNDECODES DIGITAL', { align: 'center' })
      .moveDown(0.3);
    doc
      .fontSize(14)
      .fillColor('#000')
      .text('Informe Consolidado de Gestión', { align: 'center' })
      .moveDown(1);

    doc
      .fontSize(10)
      .fillColor('gray')
      .text(`Generado el: ${fechaGeneracion}`, { align: 'right' })
      .moveDown(1);

    // === Resumen general ===
    doc
      .fontSize(12)
      .fillColor('#000')
      .text(`Total de registros analizados: ${data.totalRegistros}`)
      .moveDown(0.5);

    // === Detalles por módulo ===
    for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
      doc.moveDown(1).fontSize(14).fillColor('#003366').text(modulo.toUpperCase());

      doc
        .moveDown(0.3)
        .fontSize(11)
        .fillColor('#000')
        .text(`Total de registros: ${detalle.total}`)
        .moveDown(0.2);

      doc.fontSize(10).fillColor('black');
      for (const [grupo, cantidad] of Object.entries(detalle.grupos)) {
        doc.text(`• ${grupo}: ${cantidad}`);
      }

      doc.moveDown(1);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
    }

    // === Pie institucional ===
    doc
      .moveDown(2)
      .fontSize(10)
      .fillColor('gray')
      .text('FUNDECODES DIGITAL - Sistema Administrativo', { align: 'center' })
      .text('Documento generado automáticamente por el sistema.', {
        align: 'center',
      });

    doc.end();
    await new Promise((resolve) => doc.on('end', resolve));
    return Buffer.concat(buffers);
  }

  /* ============================================================
     📊 Generar Excel institucional FUNDECODES
  ============================================================ */
  async generarExcel(data: any): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Informe');

    // === Encabezado general ===
    sheet.mergeCells('A1', 'D1');
    const title = sheet.getCell('A1');
    title.value = 'FUNDECODES DIGITAL - Informe Consolidado';
    title.font = { size: 16, bold: true, color: { argb: '003366' } };
    title.alignment = { horizontal: 'center' };

    sheet.addRow([]);
    sheet.addRow(['Fecha de generación:', new Date().toLocaleString('es-CR')]);
    sheet.addRow(['Total general:', data.totalRegistros]);
    sheet.addRow([]);
    sheet.addRow(['Módulo', 'Periodo / Grupo', 'Cantidad']);
    sheet.getRow(5).font = { bold: true };

    // === Llenar datos ===
    for (const [modulo, detalle] of Object.entries<any>(data.detalles)) {
      for (const [grupo, cantidad] of Object.entries(detalle.grupos)) {
        sheet.addRow([modulo, grupo, cantidad]);
      }
      sheet.addRow([]);
    }

    // === Estilos ===
    sheet.columns = [
      { key: 'modulo', width: 25 },
      { key: 'grupo', width: 30 },
      { key: 'cantidad', width: 15 },
    ];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}

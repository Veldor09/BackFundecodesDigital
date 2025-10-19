// src/SistemaAdmin/reportes/utils/pdf-generator.ts
import PDFDocument from 'pdfkit';
import { Response } from 'express';

interface InformeData {
  filtros: any;
  detalles: Record<string, { total: number; grupos: Record<string, number> }>;
  fechaGeneracion: Date;
}

export async function generarPdfInforme(
  data: InformeData,
  res: Response,
): Promise<void> {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: 'Informe Anual FUNDECODES DIGITAL',
      Author: 'Sistema FUNDECODES DIGITAL',
    },
  });

  // === Encabezado institucional ===
  const logoUrl =
    'https://fundecodes.org/wp-content/uploads/2022/12/Fundecodes-Logo.png';

  // Stream directo a respuesta HTTP
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'inline; filename="informe-fundecodes.pdf"');
  doc.pipe(res);

  // Logo y encabezado
  doc
    .image(logoUrl, 50, 40, { width: 90 })
    .font('Helvetica-Bold')
    .fontSize(18)
    .fillColor('#003366')
    .text('FUNDECODES DIGITAL', 150, 50)
    .fontSize(12)
    .fillColor('black')
    .text('Informe Anual Consolidado', 150, 70)
    .moveDown(1);

  // Línea separadora
  doc.moveTo(50, 100).lineTo(550, 100).strokeColor('#003366').stroke();

  // === Datos del informe ===
  const { filtros, detalles, fechaGeneracion } = data;
  doc.moveDown(2);
  doc.font('Helvetica-Bold').text('Parámetros del informe', { underline: true });
  doc.moveDown(0.5);
  doc.font('Helvetica').fontSize(11);
  doc.text(`Periodo: ${filtros.periodo}`);
  if (filtros.anio) doc.text(`Año: ${filtros.anio}`);
  if (filtros.fechaInicio) doc.text(`Fecha inicio: ${filtros.fechaInicio}`);
  if (filtros.fechaFin) doc.text(`Fecha fin: ${filtros.fechaFin}`);
  doc.text(`Tipo de reporte: ${filtros.tipoReporte}`);
  doc.text(`Módulos: ${filtros.modulos.join(', ')}`);
  doc.text(`Fecha de generación: ${fechaGeneracion.toLocaleString('es-CR')}`);
  doc.moveDown(1.5);

  // === Tabla de resultados ===
  for (const [modulo, info] of Object.entries(detalles)) {
    doc.font('Helvetica-Bold').fontSize(13).fillColor('#003366');
    doc.text(`📘 ${modulo.toUpperCase()}`, { underline: true });
    doc.moveDown(0.3);
    doc.font('Helvetica').fillColor('black').fontSize(11);
    doc.text(`Total registros: ${info.total}`);
    doc.moveDown(0.5);

    for (const [grupo, cantidad] of Object.entries(info.grupos)) {
      doc.text(`• ${grupo}: ${cantidad}`);
    }

    doc.moveDown(1);
  }

  // === Pie de página institucional ===
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc
      .fontSize(9)
      .fillColor('gray')
      .text(
        `FUNDECODES DIGITAL — Informe generado automáticamente · Página ${
          i + 1
        } de ${pageCount}`,
        50,
        780,
        { align: 'center', width: 500 },
      );
  }

  doc.end();
}

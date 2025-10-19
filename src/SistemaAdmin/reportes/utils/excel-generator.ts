// src/SistemaAdmin/reportes/utils/excel-generator.ts
import ExcelJS from 'exceljs';
import { Response } from 'express';

interface InformeData {
  filtros: any;
  detalles: Record<string, { total: number; grupos: Record<string, number> }>;
  fechaGeneracion: Date;
}

export async function generarExcelInforme(
  data: InformeData,
  res: Response,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Informe Anual');

  sheet.columns = [
    { header: 'Módulo', key: 'modulo', width: 30 },
    { header: 'Categoría / Grupo', key: 'grupo', width: 30 },
    { header: 'Cantidad', key: 'cantidad', width: 15 },
  ];

  for (const [modulo, info] of Object.entries(data.detalles)) {
    for (const [grupo, cantidad] of Object.entries(info.grupos)) {
      sheet.addRow({ modulo, grupo, cantidad });
    }
  }

  // Encabezado estético
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF003366' },
  };

  // Preparar descarga
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="informe-fundecodes.xlsx"',
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );

  await workbook.xlsx.write(res);
  res.end();
}

import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSeguimientoReportRows } from "@/lib/seguimientoReportData";
import { getProjectContext } from "@/lib/projectContext";

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getSeguimientoReportRows(ctx.projectId);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ToolsIT Control Center";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Seguimiento");
  sheet.columns = [
    { header: "Región", key: "region", width: 18 },
    { header: "Tienda", key: "tienda", width: 26 },
    { header: "Descripción", key: "descripcion", width: 50 },
    { header: "Estado", key: "estado", width: 16 },
    { header: "Responsable", key: "responsable", width: 22 },
    { header: "Creado por", key: "creadoPor", width: 20 },
    { header: "Creado", key: "creadoEn", width: 18 },
    { header: "Completado", key: "completadoEn", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => sheet.addRow(r));

  sheet.getColumn("creadoEn").numFmt = "dd/mm/yyyy hh:mm";
  sheet.getColumn("completadoEn").numFmt = "dd/mm/yyyy hh:mm";

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `reporte-seguimiento-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

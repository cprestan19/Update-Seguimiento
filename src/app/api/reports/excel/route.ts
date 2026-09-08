import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import ExcelJS from "exceljs";
import { authOptions } from "@/lib/auth";
import { getReportRows } from "@/lib/reportData";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getReportRows();

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ToolsIT Control Center";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Tiendas");
  sheet.columns = [
    { header: "País", key: "pais", width: 16 },
    { header: "Región", key: "region", width: 18 },
    { header: "Tienda", key: "tienda", width: 26 },
    { header: "Horario", key: "horario", width: 10 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Técnico", key: "tecnico", width: 20 },
    { header: "Auditor TI", key: "auditorTI", width: 20 },
    { header: "Auditor Inventario", key: "auditorInv", width: 20 },
    { header: "Progreso %", key: "progreso", width: 12 },
    { header: "Inventario Inicial", key: "inventarioInicial", width: 16 },
    { header: "Inventario Final", key: "inventarioFinal", width: 16 },
    { header: "Costo Inicial", key: "costoInicial", width: 14 },
    { header: "Costo Final", key: "costoFinal", width: 14 },
    { header: "Incidencias Abiertas", key: "incidenciasAbiertas", width: 18 },
  ];
  sheet.getRow(1).font = { bold: true };

  rows.forEach((r) => sheet.addRow(r));

  sheet.getColumn("costoInicial").numFmt = '"$"#,##0.00';
  sheet.getColumn("costoFinal").numFmt = '"$"#,##0.00';

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `reporte-tiendas-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

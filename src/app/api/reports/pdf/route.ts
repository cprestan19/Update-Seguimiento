import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import PDFDocument from "pdfkit";
import { authOptions } from "@/lib/auth";
import { getReportRows } from "@/lib/reportData";

const COLUMNS = [
  { key: "pais", label: "País", width: 70 },
  { key: "tienda", label: "Tienda", width: 140 },
  { key: "estado", label: "Estado", width: 80 },
  { key: "progreso", label: "Avance", width: 50 },
  { key: "tecnico", label: "Técnico", width: 120 },
] as const;

const MARGIN = 40;
const PAGE_BOTTOM = 780;

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getReportRows();

  const total = rows.length;
  const completadas = rows.filter((r) => r.estado === "Completada").length;
  const progreso = rows.filter((r) => r.estado === "En progreso").length;
  const pendientes = rows.filter((r) => r.estado === "Pendiente").length;
  const incidencias = rows.filter((r) => r.estado === "Con incidencia").length;
  const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;

  const doc = new PDFDocument({ size: "A4", margin: MARGIN });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
  });

  doc.fontSize(18).font("Helvetica-Bold").text("ToolsIT Control Center");
  doc.fontSize(12).font("Helvetica").text("Reporte de tiendas");
  doc
    .fontSize(9)
    .fillColor("#666")
    .text(`Generado: ${new Date().toLocaleString("es-PA")}`);
  doc.fillColor("#000");
  doc.moveDown(0.5);

  doc
    .fontSize(10)
    .text(
      `Total: ${total}   Completadas: ${completadas}   En progreso: ${progreso}   Pendientes: ${pendientes}   Con incidencia: ${incidencias}   Avance: ${avance}%`
    );
  doc.moveDown(1);

  function drawHeader(y: number) {
    let x = MARGIN;
    doc.font("Helvetica-Bold").fontSize(9);
    for (const col of COLUMNS) {
      doc.text(col.label, x, y, { width: col.width, ellipsis: true });
      x += col.width;
    }
    doc
      .moveTo(MARGIN, y + 14)
      .lineTo(MARGIN + COLUMNS.reduce((a, c) => a + c.width, 0), y + 14)
      .strokeColor("#ccc")
      .stroke();
  }

  let y = doc.y;
  drawHeader(y);
  y += 20;

  doc.font("Helvetica").fontSize(9);
  for (const r of rows) {
    if (y > PAGE_BOTTOM) {
      doc.addPage();
      y = MARGIN;
      drawHeader(y);
      y += 20;
      doc.font("Helvetica").fontSize(9);
    }
    let x = MARGIN;
    const values: Record<(typeof COLUMNS)[number]["key"], string> = {
      pais: r.pais,
      tienda: r.tienda,
      estado: r.estado,
      progreso: `${r.progreso}%`,
      tecnico: r.tecnico,
    };
    for (const col of COLUMNS) {
      doc.text(values[col.key], x, y, { width: col.width, ellipsis: true });
      x += col.width;
    }
    y += 16;
  }

  doc.end();
  const buffer = await done;
  const filename = `reporte-tiendas-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

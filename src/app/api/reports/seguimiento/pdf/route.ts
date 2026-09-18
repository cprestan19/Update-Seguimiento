import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getSeguimientoReportRows } from "@/lib/seguimientoReportData";
import { getProjectContext } from "@/lib/projectContext";

const COLUMNS = [
  { key: "region", label: "Región", width: 90 },
  { key: "tienda", label: "Tienda", width: 110 },
  { key: "descripcion", label: "Descripción", width: 280 },
  { key: "estado", label: "Estado", width: 85 },
  { key: "responsable", label: "Responsable", width: 120 },
] as const;

const PAGE_WIDTH = 841.89; // A4 horizontal (landscape), en puntos
const PAGE_HEIGHT = 595.28;
const MARGIN = 40;

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getSeguimientoReportRows(ctx.projectId);

  const total = rows.length;
  const completados = rows.filter((r) => r.estado === "Completado").length;
  const enSeguimiento = rows.filter((r) => r.estado === "En seguimiento").length;
  const pendientes = rows.filter((r) => r.estado === "Pendiente").length;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function text(t: string, x: number, yy: number, opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {}) {
    page.drawText(t, {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.f ?? font,
      color: opts.color ?? rgb(0, 0, 0),
    });
  }

  function ellipsize(s: string, maxChars: number) {
    return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
  }

  text("ToolsIT Control Center", MARGIN, y, { size: 18, f: bold });
  y -= 22;
  text("Reporte de seguimiento post-migración", MARGIN, y, { size: 12 });
  y -= 16;
  text(`Generado: ${new Date().toLocaleString("es-PA")}`, MARGIN, y, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;

  text(
    `Total: ${total}   Pendientes: ${pendientes}   En seguimiento: ${enSeguimiento}   Completados: ${completados}`,
    MARGIN,
    y,
    { size: 10 }
  );
  y -= 24;

  function drawTableHeader() {
    let x = MARGIN;
    for (const col of COLUMNS) {
      text(col.label, x, y, { size: 9, f: bold });
      x += col.width;
    }
    y -= 6;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: MARGIN + COLUMNS.reduce((a, c) => a + c.width, 0), y },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    y -= 14;
  }

  drawTableHeader();

  const charsPerWidth = (w: number) => Math.floor(w / 5);

  for (const r of rows) {
    if (y < MARGIN + 20) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
      drawTableHeader();
    }
    let x = MARGIN;
    const values: Record<(typeof COLUMNS)[number]["key"], string> = {
      region: r.region,
      tienda: r.tienda,
      descripcion: r.descripcion,
      estado: r.estado,
      responsable: r.responsable,
    };
    for (const col of COLUMNS) {
      text(ellipsize(values[col.key], charsPerWidth(col.width)), x, y, { size: 9 });
      x += col.width;
    }
    y -= 16;
  }

  if (rows.length === 0) {
    text("Sin ítems de seguimiento registrados.", MARGIN, y, { size: 10, color: rgb(0.4, 0.4, 0.4) });
  }

  const bytes = await doc.save();
  const filename = `reporte-seguimiento-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

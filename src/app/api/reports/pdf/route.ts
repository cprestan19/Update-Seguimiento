import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { getReportRows } from "@/lib/reportData";
import { getProjectContext } from "@/lib/projectContext";

// Incluye región y los tres roles de asignación (técnico, auditor TI,
// auditor de inventario) — no solo técnico — para que el PDF refleje la
// asignación completa de cada tienda, igual que ya hace el reporte Excel.
function buildColumns(paisLabel: string) {
  return [
    { key: "pais", label: paisLabel, width: 65 },
    { key: "region", label: "Región", width: 85 },
    { key: "tienda", label: "Tienda", width: 130 },
    { key: "estado", label: "Estado", width: 75 },
    { key: "progreso", label: "Avance", width: 45 },
    { key: "tecnico", label: "Técnico", width: 110 },
    { key: "auditorTI", label: "Auditor TI", width: 110 },
    { key: "auditorInv", label: "Auditor Inv.", width: 110 },
  ] as const;
}

const PAGE_WIDTH = 841.89; // A4 horizontal (landscape), en puntos — hace falta
const PAGE_HEIGHT = 595.28; // el ancho extra para caber las 3 columnas de asignación
const MARGIN = 40;

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getReportRows(ctx.projectId);
  const COLUMNS = buildColumns(ctx.isMigrationProject ? "País" : "Departamento");

  const total = rows.length;
  const completadas = rows.filter((r) => r.estado === "Completada").length;
  const enProgreso = rows.filter((r) => r.estado === "En progreso").length;
  const pendientes = rows.filter((r) => r.estado === "Pendiente").length;
  const incidencias = rows.filter((r) => r.estado === "Con incidencia").length;
  const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;

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
      maxWidth: undefined,
    });
  }

  function ellipsize(s: string, maxChars: number) {
    return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
  }

  text("ToolsIT Control Center", MARGIN, y, { size: 18, f: bold });
  y -= 22;
  text("Reporte de tiendas", MARGIN, y, { size: 12 });
  y -= 16;
  text(`Generado: ${new Date().toLocaleString("es-PA")}`, MARGIN, y, { size: 9, color: rgb(0.4, 0.4, 0.4) });
  y -= 20;

  text(
    `Total: ${total}   Completadas: ${completadas}   En progreso: ${enProgreso}   Pendientes: ${pendientes}   Con incidencia: ${incidencias}   Avance: ${avance}%`,
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
      pais: r.pais,
      region: r.region,
      tienda: r.tienda,
      estado: r.estado,
      progreso: `${r.progreso}%`,
      tecnico: r.tecnico,
      auditorTI: r.auditorTI,
      auditorInv: r.auditorInv,
    };
    for (const col of COLUMNS) {
      text(ellipsize(values[col.key], charsPerWidth(col.width)), x, y, { size: 9 });
      x += col.width;
    }
    y -= 16;
  }

  const bytes = await doc.save();
  const filename = `reporte-tiendas-${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { prisma } from "@/lib/prisma";
import { getReportRows, type ReportRow } from "@/lib/reportData";
import { getProjectContext } from "@/lib/projectContext";

const PAGE_WIDTH = 595.28; // A4 portrait, en puntos
const PAGE_HEIGHT = 841.89;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const COLOR = {
  text: rgb(0.06, 0.09, 0.13),
  muted: rgb(0.4, 0.44, 0.52),
  border: rgb(0.8, 0.82, 0.87),
  panel: rgb(0.94, 0.96, 0.99),
  white: rgb(1, 1, 1),
  primary: rgb(0.098, 0.278, 0.882), // marca / encabezado
  primaryDark: rgb(0.055, 0.153, 0.51),
  teal: rgb(0.02, 0.75, 0.62), // COMPLETADA
  blue: rgb(0.098, 0.51, 0.98), // EN_PROGRESO
  violet: rgb(0.545, 0.29, 0.965), // PENDIENTE
  red: rgb(0.937, 0.145, 0.302), // CON_INCIDENCIA / CRITICA
  orange: rgb(0.98, 0.573, 0.02), // ALTA
};

const ESTADO_COLOR: Record<string, ReturnType<typeof rgb>> = {
  Completada: COLOR.teal,
  "En progreso": COLOR.blue,
  Pendiente: COLOR.violet,
  "Con incidencia": COLOR.red,
};

const SEVERIDAD_COLOR: Record<string, ReturnType<typeof rgb>> = {
  CRITICA: COLOR.red,
  ALTA: COLOR.orange,
  MEDIA: COLOR.blue,
  BAJA: COLOR.violet,
};

const SEVERIDAD_LABEL: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

type AtencionReason = "incidencia" | "atrasada" | "sin_tecnico";
const ATENCION_LABEL: Record<AtencionReason, string> = {
  incidencia: "Con incidencia",
  atrasada: "Atrasada",
  sin_tecnico: "Sin técnico",
};
const ATENCION_PRIORITY: Record<AtencionReason, number> = {
  incidencia: 0,
  atrasada: 1,
  sin_tecnico: 2,
};

function buildAtencion(rows: ReportRow[], nowMinutes: number) {
  const items: { row: ReportRow; reason: AtencionReason }[] = [];
  for (const r of rows) {
    if (r.estado === "Completada") continue;
    if (r.estado === "Con incidencia" || r.incidenciasAbiertas > 0) {
      items.push({ row: r, reason: "incidencia" });
    } else if (r.minutosDia < nowMinutes) {
      items.push({ row: r, reason: "atrasada" });
    } else if (r.tecnico === "Sin asignar") {
      items.push({ row: r, reason: "sin_tecnico" });
    }
  }
  return items.sort(
    (a, b) => ATENCION_PRIORITY[a.reason] - ATENCION_PRIORITY[b.reason] || a.row.minutosDia - b.row.minutosDia
  );
}

function buildPaisAvance(rows: ReportRow[]) {
  const map = new Map<string, ReportRow[]>();
  for (const r of rows) {
    if (!map.has(r.pais)) map.set(r.pais, []);
    map.get(r.pais)!.push(r);
  }
  return Array.from(map.entries())
    .map(([pais, list]) => {
      const total = list.length;
      const completadas = list.filter((r) => r.estado === "Completada").length;
      const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
      return { pais, total, completadas, pct };
    })
    .sort((a, b) => b.pct - a.pct);
}

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const rows = await getReportRows(ctx.projectId);
  const paisLabel = ctx.isMigrationProject ? "País" : "Departamento";

  const openIncidents = await prisma.incident.findMany({
    where: { resuelta: false, store: { projectId: ctx.projectId } },
    include: { store: { select: { pais: true, tienda: true } } },
    orderBy: { createdAt: "desc" },
  });

  const total = rows.length;
  const completadas = rows.filter((r) => r.estado === "Completada").length;
  const enProgreso = rows.filter((r) => r.estado === "En progreso").length;
  const pendientes = rows.filter((r) => r.estado === "Pendiente").length;
  const conIncidencia = rows.filter((r) => r.estado === "Con incidencia").length;
  const avanceGlobal = total > 0 ? Math.round((completadas / total) * 100) : 0;

  const now = new Date();
  const atencion = buildAtencion(rows, now.getHours() * 60 + now.getMinutes());
  const paisAvance = buildPaisAvance(rows);

  const severidadCounts: Record<string, number> = { CRITICA: 0, ALTA: 0, MEDIA: 0, BAJA: 0 };
  for (const inc of openIncidents) severidadCounts[inc.severidad] = (severidadCounts[inc.severidad] || 0) + 1;

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function newPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) newPage();
  }

  function text(
    t: string,
    x: number,
    yy: number,
    opts: { size?: number; f?: typeof font; color?: ReturnType<typeof rgb> } = {}
  ) {
    page.drawText(t, {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.f ?? font,
      color: opts.color ?? COLOR.text,
    });
  }

  function ellipsize(s: string, maxChars: number) {
    return s.length > maxChars ? s.slice(0, maxChars - 1) + "…" : s;
  }

  function sectionTitle(t: string) {
    ensureSpace(32);
    page.drawRectangle({ x: MARGIN, y: y - 10, width: 4, height: 13, color: COLOR.primary });
    text(t, MARGIN + 10, y, { size: 13, f: bold, color: COLOR.primaryDark });
    y -= 10;
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 1.25,
      color: COLOR.primary,
    });
    y -= 16;
  }

  function bar(x: number, yy: number, w: number, h: number, pct: number, color: ReturnType<typeof rgb>) {
    page.drawRectangle({ x, y: yy, width: w, height: h, color: COLOR.panel, borderColor: COLOR.border, borderWidth: 0.5 });
    const fillW = Math.max(0, Math.min(1, pct / 100)) * w;
    if (fillW > 0) {
      page.drawRectangle({ x, y: yy, width: fillW, height: h, color });
    }
  }

  // ---- Encabezado ----
  const HEADER_H = 78;
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_H, width: PAGE_WIDTH, height: HEADER_H, color: COLOR.primary });
  page.drawRectangle({ x: 0, y: PAGE_HEIGHT - HEADER_H - 3, width: PAGE_WIDTH, height: 3, color: COLOR.teal });
  text("ToolsIT Control Center", MARGIN, PAGE_HEIGHT - 30, { size: 19, f: bold, color: COLOR.white });
  text("Resumen ejecutivo · Migración RPro v9 → Prism 2.4", MARGIN, PAGE_HEIGHT - 50, {
    size: 12,
    f: bold,
    color: rgb(0.85, 0.9, 1),
  });
  text(`Generado: ${now.toLocaleString("es-PA")}`, MARGIN, PAGE_HEIGHT - 65, { size: 9, color: rgb(0.85, 0.9, 1) });
  y = PAGE_HEIGHT - HEADER_H - 24;

  // ---- KPIs ----
  const kpis: { label: string; value: string; color: ReturnType<typeof rgb> }[] = [
    { label: "Total tiendas", value: String(total), color: COLOR.primary },
    { label: "Completadas", value: String(completadas), color: COLOR.teal },
    { label: "En progreso", value: String(enProgreso), color: COLOR.blue },
    { label: "Pendientes", value: String(pendientes), color: COLOR.violet },
    { label: "Con incidencia", value: String(conIncidencia), color: COLOR.red },
  ];
  const cardGap = 10;
  const cardW = (CONTENT_WIDTH - cardGap * (kpis.length - 1)) / kpis.length;
  const cardH = 52;
  ensureSpace(cardH + 10);
  kpis.forEach((k, i) => {
    const x = MARGIN + i * (cardW + cardGap);
    page.drawRectangle({ x, y: y - cardH, width: cardW, height: cardH, color: COLOR.panel, borderColor: COLOR.border, borderWidth: 0.75 });
    page.drawRectangle({ x, y: y - 4, width: cardW, height: 4, color: k.color });
    text(k.value, x + 10, y - 26, { size: 21, f: bold, color: k.color });
    text(k.label, x + 10, y - 42, { size: 8, color: COLOR.muted });
  });
  y -= cardH + 24;

  // ---- Avance global ----
  sectionTitle("Avance global");
  text(`${avanceGlobal}% de las tiendas completadas`, MARGIN, y, { size: 10 });
  y -= 14;
  bar(MARGIN, y - 12, CONTENT_WIDTH, 14, avanceGlobal, COLOR.teal);
  y -= 32;

  // ---- Avance por país / departamento ----
  sectionTitle(`Avance por ${paisLabel.toLowerCase()}`);
  const paisLabelW = 110;
  const paisPctW = 90;
  const paisBarW = CONTENT_WIDTH - paisLabelW - paisPctW;
  for (const p of paisAvance) {
    ensureSpace(20);
    text(ellipsize(p.pais, 20), MARGIN, y - 9, { size: 9 });
    bar(MARGIN + paisLabelW, y - 12, paisBarW, 12, p.pct, p.pct === 100 ? COLOR.teal : COLOR.blue);
    text(`${p.pct}%  (${p.completadas}/${p.total})`, MARGIN + paisLabelW + paisBarW + 8, y - 9, {
      size: 9,
      color: COLOR.muted,
    });
    y -= 18;
  }
  y -= 6;

  // ---- Tiendas que requieren atención ----
  sectionTitle("Tiendas que requieren atención");
  const conteoAtencion: Record<AtencionReason, number> = { incidencia: 0, atrasada: 0, sin_tecnico: 0 };
  for (const a of atencion) conteoAtencion[a.reason]++;
  text(
    `Con incidencia: ${conteoAtencion.incidencia}   Atrasadas: ${conteoAtencion.atrasada}   Sin técnico asignado: ${conteoAtencion.sin_tecnico}`,
    MARGIN,
    y,
    { size: 10 }
  );
  y -= 20;

  if (atencion.length === 0) {
    text("Sin pendientes — todas las tiendas están al día.", MARGIN, y, { size: 9, color: COLOR.muted });
    y -= 18;
  } else {
    const cols = [
      { label: paisLabel, w: 80 },
      { label: "Tienda", w: 175 },
      { label: "Motivo", w: 100 },
      { label: "Técnico", w: 160 },
    ] as const;
    ensureSpace(18);
    let x = MARGIN;
    for (const c of cols) {
      text(c.label, x, y, { size: 9, f: bold });
      x += c.w;
    }
    y -= 6;
    page.drawLine({ start: { x: MARGIN, y }, end: { x: PAGE_WIDTH - MARGIN, y }, thickness: 0.5, color: COLOR.border });
    y -= 14;

    const LIMIT = 25;
    for (const item of atencion.slice(0, LIMIT)) {
      ensureSpace(16);
      x = MARGIN;
      text(ellipsize(item.row.pais, 16), x, y, { size: 9 });
      x += cols[0].w;
      text(ellipsize(item.row.tienda, 30), x, y, { size: 9 });
      x += cols[1].w;
      text(ATENCION_LABEL[item.reason], x, y, { size: 9, color: item.reason === "incidencia" ? COLOR.red : COLOR.text });
      x += cols[2].w;
      text(ellipsize(item.row.tecnico, 28), x, y, { size: 9, color: COLOR.muted });
      y -= 16;
    }
    if (atencion.length > LIMIT) {
      text(`… y ${atencion.length - LIMIT} tienda(s) más.`, MARGIN, y, { size: 8, color: COLOR.muted });
      y -= 16;
    }
  }
  y -= 6;

  // ---- Incidencias abiertas por severidad ----
  sectionTitle("Incidencias abiertas por severidad");
  const sevOrder = ["CRITICA", "ALTA", "MEDIA", "BAJA"];
  const sevGap = 10;
  const sevW = (CONTENT_WIDTH - sevGap * (sevOrder.length - 1)) / sevOrder.length;
  ensureSpace(46);
  sevOrder.forEach((sev, i) => {
    const x = MARGIN + i * (sevW + sevGap);
    page.drawRectangle({ x, y: y - 40, width: sevW, height: 40, color: COLOR.panel, borderColor: COLOR.border, borderWidth: 0.75 });
    page.drawRectangle({ x, y: y - 40, width: 4, height: 40, color: SEVERIDAD_COLOR[sev] });
    page.drawRectangle({ x: x + 14, y: y - 20, width: 8, height: 8, color: SEVERIDAD_COLOR[sev] });
    text(String(severidadCounts[sev] || 0), x + sevW - 24, y - 24, { size: 14, f: bold });
    text(SEVERIDAD_LABEL[sev], x + 24, y - 17, { size: 8, color: COLOR.muted });
  });
  y -= 56;

  const bytes = await doc.save();
  const filename = `resumen-ejecutivo-${now.toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

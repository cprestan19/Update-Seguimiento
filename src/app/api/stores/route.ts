import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";
import { instantiateChecklistForStore } from "@/lib/storeChecklist";

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const stores = await prisma.store.findMany({
    where: { projectId: ctx.projectId },
    orderBy: { minutosDia: "asc" },
    include: {
      tecnico: { select: { id: true, name: true } },
      auditorTI: { select: { id: true, name: true } },
      auditorInv: { select: { id: true, name: true } },
      checklist: { select: { completado: true, noAplica: true } },
      incidents: { where: { resuelta: false }, select: { id: true } },
    },
  });

  const data = stores.map((s) => {
    const aplicables = s.checklist.filter((c) => !c.noAplica);
    const total = aplicables.length;
    const done = aplicables.filter((c) => c.completado).length;
    return {
      id: s.id,
      pais: s.pais,
      region: s.region,
      tienda: s.tienda,
      horario: s.horario,
      inicioReal: s.inicioReal,
      minutosDia: s.minutosDia,
      estado: s.estado,
      tecnico: s.tecnico,
      auditorTI: s.auditorTI,
      auditorInv: s.auditorInv,
      tiempoEstimadoMin: s.tiempoEstimadoMin,
      duracionRealMin: s.duracionRealMin,
      progreso: total > 0 ? Math.round((done / total) * 100) : 100,
      incidenciasAbiertas: s.incidents.length,
    };
  });

  return NextResponse.json(data);
}

function parseHorario(h: string): number {
  const upper = h.trim().toUpperCase();
  const isMD = upper.includes("MD");
  const clean = upper.replace("MD", "PM").replace("AM", "").replace("PM", "");
  const [hhStr, mmStr] = clean.split(":");
  let hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10) || 0;
  const isPM = upper.includes("PM") || isMD;
  if (hh === 12) hh = isPM ? 12 : 0;
  else if (isPM) hh += 12;
  return (hh % 24) * 60 + mm;
}

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede agregar tiendas" }, { status: 403 });
  }

  const { pais, region, tienda, horario } = (await req.json()) as {
    pais: string;
    region: string;
    tienda: string;
    horario: string;
  };

  if (!pais?.trim() || !region?.trim() || !tienda?.trim() || !horario?.trim()) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const store = await prisma.store.create({
    data: {
      projectId: ctx.projectId,
      pais: pais.trim(),
      region: region.trim(),
      tienda: tienda.trim(),
      horario: horario.trim(),
      minutosDia: parseHorario(horario),
    },
  });

  await instantiateChecklistForStore(store.id, ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "TIENDA_CREADA",
      entidad: `Store:${store.id}`,
      detalle: store.tienda,
    },
  });

  return NextResponse.json(store);
}

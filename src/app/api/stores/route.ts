import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const stores = await prisma.store.findMany({
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

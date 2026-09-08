import { prisma } from "@/lib/prisma";

export type ReportRow = {
  pais: string;
  region: string;
  tienda: string;
  horario: string;
  estado: string;
  tecnico: string;
  auditorTI: string;
  auditorInv: string;
  progreso: number;
  inventarioInicial: number | null;
  inventarioFinal: number | null;
  costoInicial: number | null;
  costoFinal: number | null;
  incidenciasAbiertas: number;
};

export const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADA: "Completada",
  CON_INCIDENCIA: "Con incidencia",
};

export async function getReportRows(): Promise<ReportRow[]> {
  const stores = await prisma.store.findMany({
    orderBy: { minutosDia: "asc" },
    include: {
      tecnico: { select: { name: true } },
      auditorTI: { select: { name: true } },
      auditorInv: { select: { name: true } },
      checklist: { select: { completado: true, noAplica: true } },
      incidents: { where: { resuelta: false }, select: { id: true } },
    },
  });

  return stores.map((s) => {
    const aplicables = s.checklist.filter((c) => !c.noAplica);
    const total = aplicables.length;
    const done = aplicables.filter((c) => c.completado).length;
    return {
      pais: s.pais,
      region: s.region,
      tienda: s.tienda,
      horario: s.horario,
      estado: ESTADO_LABEL[s.estado] || s.estado,
      tecnico: s.tecnico?.name || "Sin asignar",
      auditorTI: s.auditorTI?.name || "Sin asignar",
      auditorInv: s.auditorInv?.name || "Sin asignar",
      progreso: total > 0 ? Math.round((done / total) * 100) : 100,
      inventarioInicial: s.inventarioInicial,
      inventarioFinal: s.inventarioFinal,
      costoInicial: s.costoInicial,
      costoFinal: s.costoFinal,
      incidenciasAbiertas: s.incidents.length,
    };
  });
}

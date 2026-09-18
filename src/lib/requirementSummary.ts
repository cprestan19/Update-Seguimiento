import { prisma } from "@/lib/prisma";
import { calcularSla } from "@/lib/requirementSla";

const ESTADOS_CERRADOS = ["IMPLEMENTADO", "CERRADO", "CANCELADO"];
const ESTADOS_ANALISIS = ["SOLICITUD", "ANALISIS", "APROBADO"];
const ESTADOS_EJECUCION = ["EN_DESARROLLO", "EN_IMPLEMENTACION"];

export type AtencionReason = "vencido" | "bloqueado" | "proximo" | "sin_responsable";

const ATENCION_PRIORITY: Record<AtencionReason, number> = {
  vencido: 0,
  bloqueado: 1,
  proximo: 2,
  sin_responsable: 3,
};

export async function getRequirementSummary(projectId: string) {
  const rows = await prisma.requirement.findMany({
    where: { projectId, activo: true },
    select: {
      id: true,
      numero: true,
      titulo: true,
      estado: true,
      prioridad: true,
      bloqueado: true,
      fechaEstimadaEntrega: true,
      fechaRealEntrega: true,
      responsableTecnico: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  const withSla = rows.map((r) => ({
    ...r,
    sla: calcularSla(r.fechaEstimadaEntrega, r.fechaRealEntrega, r.estado, now),
  }));

  const total = rows.length;
  const pendientes = rows.filter((r) => r.estado === "SOLICITUD").length;
  const enAnalisis = rows.filter((r) => ESTADOS_ANALISIS.includes(r.estado)).length;
  const enEjecucion = rows.filter((r) => ESTADOS_EJECUCION.includes(r.estado)).length;
  const enPruebas = rows.filter((r) => r.estado === "EN_PRUEBAS").length;
  const implementados = rows.filter((r) => r.estado === "IMPLEMENTADO" || r.estado === "CERRADO").length;
  const vencidos = withSla.filter((r) => r.sla.vencido).length;
  const proximosAVencer = withSla.filter((r) => r.sla.proximoAVencer).length;

  const atencion: { requirement: (typeof withSla)[number]; reason: AtencionReason }[] = [];
  for (const r of withSla) {
    if (ESTADOS_CERRADOS.includes(r.estado)) continue;
    if (r.sla.vencido) atencion.push({ requirement: r, reason: "vencido" });
    else if (r.bloqueado) atencion.push({ requirement: r, reason: "bloqueado" });
    else if (r.sla.proximoAVencer) atencion.push({ requirement: r, reason: "proximo" });
    else if (!r.responsableTecnico) atencion.push({ requirement: r, reason: "sin_responsable" });
  }
  atencion.sort(
    (a, b) =>
      ATENCION_PRIORITY[a.reason] - ATENCION_PRIORITY[b.reason] ||
      a.requirement.fechaEstimadaEntrega.getTime() - b.requirement.fechaEstimadaEntrega.getTime()
  );

  return {
    kpis: { total, pendientes, enAnalisis, enEjecucion, enPruebas, implementados, vencidos, proximosAVencer },
    atencion: atencion.map((a) => ({
      id: a.requirement.id,
      numero: a.requirement.numero,
      titulo: a.requirement.titulo,
      prioridad: a.requirement.prioridad,
      responsable: a.requirement.responsableTecnico?.name || null,
      reason: a.reason,
      slaLabel: a.requirement.sla.label,
    })),
  };
}

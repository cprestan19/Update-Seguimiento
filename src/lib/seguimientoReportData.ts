import { prisma } from "@/lib/prisma";

export type SeguimientoReportRow = {
  region: string;
  tienda: string;
  descripcion: string;
  estado: string;
  responsable: string;
  creadoPor: string;
  creadoEn: Date;
  completadoEn: Date | null;
};

export const ESTADO_SEGUIMIENTO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_SEGUIMIENTO: "En seguimiento",
  COMPLETADO: "Completado",
};

export async function getSeguimientoReportRows(projectId: string): Promise<SeguimientoReportRow[]> {
  const items = await prisma.seguimientoItem.findMany({
    where: { projectId },
    orderBy: [{ region: "asc" }, { createdAt: "asc" }],
    include: {
      responsable: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
  });

  return items.map((it) => ({
    region: it.region,
    tienda: it.tienda || "General / Todos",
    descripcion: it.descripcion,
    estado: ESTADO_SEGUIMIENTO_LABEL[it.estado] || it.estado,
    responsable: it.responsable?.name || "Sin asignar",
    creadoPor: it.createdBy?.name || "—",
    creadoEn: it.createdAt,
    completadoEn: it.completadoEn,
  }));
}

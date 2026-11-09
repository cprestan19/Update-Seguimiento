import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";
import { recalcularEstadoTienda } from "@/lib/storeStatus";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const existente = await prisma.incident.findFirst({
    where: { id: params.id, store: { projectId: ctx.projectId } },
  });
  if (!existente) return NextResponse.json({ error: "Incidencia no encontrada" }, { status: 404 });

  const incident = await prisma.incident.update({
    where: { id: params.id },
    data: { resuelta: true, resolvedById: ctx.userId, resolvedAt: new Date() },
  });

  const abiertas = await prisma.incident.count({
    where: { storeId: incident.storeId, resuelta: false },
  });

  if (abiertas === 0) {
    // Reusar la lógica central: excluye ítems "no aplica" y mantiene las
    // marcas de tiempo (inicioReal/finReal/duración) coherentes.
    await recalcularEstadoTienda(incident.storeId);
  }
  await publishChange("stores", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "INCIDENCIA_RESUELTA",
      entidad: `Incident:${incident.id}`,
    },
  });

  return NextResponse.json(incident);
}

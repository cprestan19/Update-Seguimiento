import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

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
    const items = await prisma.storeChecklistItem.findMany({ where: { storeId: incident.storeId } });
    const total = items.length;
    const done = items.filter((i) => i.completado).length;
    const estado = done === 0 ? "PENDIENTE" : done < total ? "EN_PROGRESO" : "COMPLETADA";
    await prisma.store.update({ where: { id: incident.storeId }, data: { estado } });
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

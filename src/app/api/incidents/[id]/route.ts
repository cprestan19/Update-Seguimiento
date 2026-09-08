import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";

export async function PATCH(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const incident = await prisma.incident.update({
    where: { id: params.id },
    data: { resuelta: true, resolvedById: session.user.id, resolvedAt: new Date() },
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
  await publishChange("stores");

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "INCIDENCIA_RESUELTA",
      entidad: `Incident:${incident.id}`,
    },
  });

  return NextResponse.json(incident);
}

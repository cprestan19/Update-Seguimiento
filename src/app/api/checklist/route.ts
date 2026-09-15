import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularEstadoTienda } from "@/lib/storeStatus";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const { storeChecklistItemId } = (await req.json()) as { storeChecklistItemId: string };
  if (!storeChecklistItemId) {
    return NextResponse.json({ error: "Falta storeChecklistItemId" }, { status: 400 });
  }

  const current = await prisma.storeChecklistItem.findFirst({
    where: { id: storeChecklistItemId, store: { projectId: ctx.projectId } },
  });
  if (!current) return NextResponse.json({ error: "Item no encontrado" }, { status: 404 });
  if (current.noAplica) {
    return NextResponse.json({ error: "Este item está marcado como no aplica" }, { status: 400 });
  }

  const nuevoValor = !current.completado;

  const updated = await prisma.storeChecklistItem.update({
    where: { id: storeChecklistItemId },
    data: {
      completado: nuevoValor,
      completadoPorId: nuevoValor ? ctx.userId : null,
      completadoEn: nuevoValor ? new Date() : null,
    },
  });

  await recalcularEstadoTienda(current.storeId);
  await publishChange("stores", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_TOGGLE",
      entidad: `StoreChecklistItem:${storeChecklistItemId}`,
      detalle: `completado=${nuevoValor}`,
    },
  });

  return NextResponse.json(updated);
}

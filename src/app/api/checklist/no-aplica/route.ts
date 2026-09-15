import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularEstadoTienda } from "@/lib/storeStatus";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

// Marca/desmarca un item del checklist como "No aplica" para esa tienda.
// Un item marcado no aplica se excluye del total de progreso y no cuenta
// como pendiente.
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

  const nuevoValor = !current.noAplica;

  const updated = await prisma.storeChecklistItem.update({
    where: { id: storeChecklistItemId },
    data: {
      noAplica: nuevoValor,
      completado: false,
      completadoPorId: null,
      completadoEn: null,
    },
  });

  await recalcularEstadoTienda(current.storeId);
  await publishChange("stores", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_NO_APLICA",
      entidad: `StoreChecklistItem:${storeChecklistItemId}`,
      detalle: `noAplica=${nuevoValor}`,
    },
  });

  return NextResponse.json(updated);
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcularEstadoTienda } from "@/lib/storeStatus";
import { publishChange } from "@/lib/realtime";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const { storeChecklistItemId } = (await req.json()) as { storeChecklistItemId: string };
  if (!storeChecklistItemId) {
    return NextResponse.json({ error: "Falta storeChecklistItemId" }, { status: 400 });
  }

  const current = await prisma.storeChecklistItem.findUnique({
    where: { id: storeChecklistItemId },
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
      completadoPorId: nuevoValor ? session.user.id : null,
      completadoEn: nuevoValor ? new Date() : null,
    },
  });

  await recalcularEstadoTienda(current.storeId);
  await publishChange("stores");

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "CHECKLIST_TOGGLE",
      entidad: `StoreChecklistItem:${storeChecklistItemId}`,
      detalle: `completado=${nuevoValor}`,
    },
  });

  return NextResponse.json(updated);
}

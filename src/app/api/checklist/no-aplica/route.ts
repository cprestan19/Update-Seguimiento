import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recalcularEstadoTienda } from "@/lib/storeStatus";

// Marca/desmarca un item del checklist como "No aplica" para esa tienda.
// Un item marcado no aplica se excluye del total de progreso y no cuenta
// como pendiente.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { storeChecklistItemId } = (await req.json()) as { storeChecklistItemId: string };
  if (!storeChecklistItemId) {
    return NextResponse.json({ error: "Falta storeChecklistItemId" }, { status: 400 });
  }

  const current = await prisma.storeChecklistItem.findUnique({
    where: { id: storeChecklistItemId },
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

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "CHECKLIST_NO_APLICA",
      entidad: `StoreChecklistItem:${storeChecklistItemId}`,
      detalle: `noAplica=${nuevoValor}`,
    },
  });

  return NextResponse.json(updated);
}

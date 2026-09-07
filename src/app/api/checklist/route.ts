import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

  const nuevoValor = !current.completado;

  const updated = await prisma.storeChecklistItem.update({
    where: { id: storeChecklistItemId },
    data: {
      completado: nuevoValor,
      completadoPorId: nuevoValor ? session.user.id : null,
      completadoEn: nuevoValor ? new Date() : null,
    },
  });

  // Recalcular estado de la tienda
  const allItems = await prisma.storeChecklistItem.findMany({
    where: { storeId: current.storeId },
  });
  const total = allItems.length;
  const done = allItems.filter((i) => i.completado).length;

  const store = await prisma.store.findUnique({
    where: { id: current.storeId },
    include: { incidents: { where: { resuelta: false } } },
  });

  if (store) {
    const tieneIncidenciaAbierta = store.incidents.length > 0;
    let nuevoEstado = store.estado;
    let inicioReal = store.inicioReal;
    let finReal = store.finReal;
    let duracionRealMin = store.duracionRealMin;

    if (!tieneIncidenciaAbierta) {
      if (done === 0) {
        nuevoEstado = "PENDIENTE";
        inicioReal = null;
        finReal = null;
        duracionRealMin = null;
      } else if (done < total) {
        nuevoEstado = "EN_PROGRESO";
        if (!inicioReal) inicioReal = new Date();
      } else {
        nuevoEstado = "COMPLETADA";
        finReal = new Date();
        if (inicioReal) {
          duracionRealMin = Math.round((finReal.getTime() - inicioReal.getTime()) / 60000);
        }
      }
    }

    await prisma.store.update({
      where: { id: store.id },
      data: { estado: nuevoEstado, inicioReal, finReal, duracionRealMin },
    });
  }

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

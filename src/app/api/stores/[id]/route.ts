import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const store = await prisma.store.findUnique({
    where: { id: params.id },
    include: {
      tecnico: { select: { id: true, name: true } },
      auditorTI: { select: { id: true, name: true } },
      auditorInv: { select: { id: true, name: true } },
      checklist: {
        include: { itemDef: { include: { category: true } }, completadoPor: { select: { name: true } } },
      },
      incidents: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  return NextResponse.json(store);
}

// Solo ADMIN puede reasignar personal a una tienda
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede reasignar personal" }, { status: 403 });
  }

  const body = await req.json();
  const { tecnicoId, auditorTIId, auditorInvId } = body as {
    tecnicoId?: string | null;
    auditorTIId?: string | null;
    auditorInvId?: string | null;
  };

  const store = await prisma.store.update({
    where: { id: params.id },
    data: {
      tecnicoId: tecnicoId === "" ? null : tecnicoId,
      auditorTIId: auditorTIId === "" ? null : auditorTIId,
      auditorInvId: auditorInvId === "" ? null : auditorInvId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "ASIGNACION",
      entidad: `Store:${store.id}`,
      detalle: JSON.stringify({ tecnicoId, auditorTIId, auditorInvId }),
    },
  });

  return NextResponse.json(store);
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const items = await prisma.seguimientoItem.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      store: { select: { id: true, region: true, tienda: true, pais: true } },
      responsable: { select: { id: true, name: true, personnelRole: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const { region, tienda, storeId, descripcion, responsableId } = (await req.json()) as {
    region: string;
    tienda?: string | null;
    storeId?: string | null;
    descripcion: string;
    responsableId?: string | null;
  };

  if (!region?.trim() || !descripcion?.trim()) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  if (storeId) {
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }

  const item = await prisma.seguimientoItem.create({
    data: {
      region: region.trim(),
      tienda: tienda?.trim() || null,
      storeId: storeId || null,
      descripcion: descripcion.trim(),
      responsableId: responsableId || null,
      createdById: session.user.id,
    },
    include: {
      store: { select: { id: true, region: true, tienda: true, pais: true } },
      responsable: { select: { id: true, name: true, personnelRole: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  await publishChange("seguimiento");

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "SEGUIMIENTO_CREADO",
      entidad: `SeguimientoItem:${item.id}`,
      detalle: descripcion.trim(),
    },
  });

  return NextResponse.json(item);
}

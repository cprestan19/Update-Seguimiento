import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const items = await prisma.seguimientoItem.findMany({
    where: { projectId: ctx.projectId },
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
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
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
    const store = await prisma.store.findFirst({ where: { id: storeId, projectId: ctx.projectId } });
    if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });
  }

  const item = await prisma.seguimientoItem.create({
    data: {
      projectId: ctx.projectId,
      region: region.trim(),
      tienda: tienda?.trim() || null,
      storeId: storeId || null,
      descripcion: descripcion.trim(),
      responsableId: responsableId || null,
      createdById: ctx.userId,
    },
    include: {
      store: { select: { id: true, region: true, tienda: true, pais: true } },
      responsable: { select: { id: true, name: true, personnelRole: true } },
      createdBy: { select: { id: true, name: true } },
    },
  });

  await publishChange("seguimiento", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "SEGUIMIENTO_CREADO",
      entidad: `SeguimientoItem:${item.id}`,
      detalle: descripcion.trim(),
    },
  });

  return NextResponse.json(item);
}

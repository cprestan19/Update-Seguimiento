import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const { storeId, severidad, descripcion } = (await req.json()) as {
    storeId: string;
    severidad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    descripcion: string;
  };

  if (!storeId || !descripcion?.trim()) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const store = await prisma.store.findFirst({ where: { id: storeId, projectId: ctx.projectId } });
  if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  const incident = await prisma.incident.create({
    data: {
      storeId,
      severidad: severidad || "MEDIA",
      descripcion: descripcion.trim(),
      createdById: ctx.userId,
    },
  });

  await prisma.store.update({
    where: { id: storeId },
    data: { estado: "CON_INCIDENCIA" },
  });
  await publishChange("stores", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "INCIDENCIA_CREADA",
      entidad: `Store:${storeId}`,
      detalle: descripcion.trim(),
    },
  });

  return NextResponse.json(incident);
}

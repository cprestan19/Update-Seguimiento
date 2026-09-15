import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

const ESTADOS = ["PENDIENTE", "EN_SEGUIMIENTO", "COMPLETADO"] as const;

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const existente = await prisma.seguimientoItem.findFirst({
    where: { id: params.id, projectId: ctx.projectId },
  });
  if (!existente) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });

  const body = (await req.json()) as {
    estado?: (typeof ESTADOS)[number];
    descripcion?: string;
    region?: string;
    tienda?: string | null;
    responsableId?: string | null;
  };

  const data: Record<string, unknown> = {};
  if (body.estado) {
    if (!ESTADOS.includes(body.estado)) {
      return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    }
    data.estado = body.estado;
    data.completadoEn = body.estado === "COMPLETADO" ? new Date() : null;
  }
  if (typeof body.descripcion === "string") {
    if (!body.descripcion.trim()) {
      return NextResponse.json({ error: "La descripción no puede quedar vacía" }, { status: 400 });
    }
    data.descripcion = body.descripcion.trim();
  }
  if (typeof body.region === "string") {
    if (!body.region.trim()) {
      return NextResponse.json({ error: "La región no puede quedar vacía" }, { status: 400 });
    }
    data.region = body.region.trim();
  }
  if ("tienda" in body) {
    data.tienda = body.tienda?.trim() || null;
  }
  if ("responsableId" in body) {
    data.responsableId = body.responsableId || null;
  }

  const item = await prisma.seguimientoItem.update({
    where: { id: params.id },
    data,
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
      accion: "SEGUIMIENTO_ACTUALIZADO",
      entidad: `SeguimientoItem:${item.id}`,
      detalle: body.estado ? `Estado -> ${body.estado}` : "Edición",
    },
  });

  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const existente = await prisma.seguimientoItem.findFirst({
    where: { id: params.id, projectId: ctx.projectId },
  });
  if (!existente) return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });

  await prisma.seguimientoItem.delete({ where: { id: params.id } });
  await publishChange("seguimiento", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "SEGUIMIENTO_ELIMINADO",
      entidad: `SeguimientoItem:${params.id}`,
    },
  });

  return NextResponse.json({ ok: true });
}

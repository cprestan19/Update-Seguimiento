import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const requirement = await prisma.requirement.findFirst({
    where: { id: params.id, projectId: ctx.projectId, activo: true },
    select: { id: true, numero: true },
  });
  if (!requirement) return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });

  const { descripcion } = (await req.json()) as { descripcion?: string };
  if (!descripcion?.trim()) {
    return NextResponse.json({ error: "El comentario no puede estar vacío" }, { status: 400 });
  }

  const activity = await prisma.requirementActivity.create({
    data: {
      requirementId: requirement.id,
      tipo: "COMENTARIO",
      descripcion: descripcion.trim(),
      userId: ctx.userId,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  await publishChange("requerimientos", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "REQUERIMIENTO_COMENTARIO_AGREGADO",
      entidad: `Requirement:${requirement.id}`,
      detalle: requirement.numero,
    },
  });

  return NextResponse.json(activity);
}

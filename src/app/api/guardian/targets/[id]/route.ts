import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const target = await prisma.guardianTarget.findFirst({
    where: { id: params.id, projectId: ctx.projectId },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          profile: true,
          types: true,
          status: true,
          createdAt: true,
          finishedAt: true,
          countCritical: true,
          countHigh: true,
          countMedium: true,
          countLow: true,
          countInfo: true,
        },
      },
    },
  });

  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });
  return NextResponse.json(target);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede eliminar objetivos" }, { status: 403 });
  }

  const target = await prisma.guardianTarget.findFirst({ where: { id: params.id, projectId: ctx.projectId } });
  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });

  await prisma.guardianTarget.delete({ where: { id: target.id } });
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "GUARDIAN_TARGET_ELIMINADO",
      entidad: `GuardianTarget:${target.id}`,
      detalle: target.name,
    },
  });

  return NextResponse.json({ ok: true });
}

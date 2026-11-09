import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";

const STATUSES = ["OPEN", "CONFIRMED", "FALSE_POSITIVE", "FIXED", "ACCEPTED_RISK"];

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") return NextResponse.json({ error: "El rol Monitor solo puede ver" }, { status: 403 });

  const { status } = (await req.json().catch(() => ({}))) as { status?: string };
  if (!status || !STATUSES.includes(status)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }

  const finding = await prisma.guardianFinding.findFirst({
    where: { id: params.id, scan: { target: { projectId: ctx.projectId } } },
  });
  if (!finding) return NextResponse.json({ error: "Hallazgo no encontrado" }, { status: 404 });

  const updated = await prisma.guardianFinding.update({
    where: { id: finding.id },
    data: { status: status as (typeof STATUSES)[number] as never },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "GUARDIAN_FINDING_ACTUALIZADO",
      entidad: `GuardianFinding:${finding.id}`,
      detalle: status,
    },
  });

  return NextResponse.json(updated);
}

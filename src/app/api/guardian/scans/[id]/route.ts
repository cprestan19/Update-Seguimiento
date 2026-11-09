import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";

const SEVERITY_RANK: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4 };

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const scan = await prisma.guardianScan.findFirst({
    where: { id: params.id, target: { projectId: ctx.projectId } },
    include: {
      target: { select: { id: true, name: true, type: true, url: true, verification: true } },
      findings: true,
    },
  });
  if (!scan) return NextResponse.json({ error: "Escaneo no encontrado" }, { status: 404 });

  // Ordenar hallazgos por severidad descendente.
  scan.findings.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  return NextResponse.json(scan);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";
import { parseGitHubUrl } from "@/lib/guardian/github";
import { assertPublicUrl } from "@/lib/guardian/ssrfGuard";
import { newVerificationToken } from "@/lib/guardian/ownership";

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const targets = await prisma.guardianTarget.findMany({
    where: { projectId: ctx.projectId },
    orderBy: { createdAt: "desc" },
    include: {
      scans: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, status: true, createdAt: true, countCritical: true, countHigh: true, countMedium: true },
      },
    },
  });

  return NextResponse.json(targets);
}

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    type?: "URL" | "REPO";
    url?: string;
    description?: string;
  };

  const name = body.name?.trim();
  const url = body.url?.trim();
  if (!name || !url || (body.type !== "URL" && body.type !== "REPO")) {
    return NextResponse.json({ error: "Nombre, tipo (URL|REPO) y URL son obligatorios" }, { status: 400 });
  }

  // Validaciones por tipo
  if (body.type === "REPO") {
    if (!parseGitHubUrl(url)) {
      return NextResponse.json({ error: "El análisis de repositorios v1 soporta URLs públicas de GitHub" }, { status: 400 });
    }
  } else {
    const check = await assertPublicUrl(url);
    if (!check.ok) {
      return NextResponse.json({ error: `URL no permitida: ${check.reason}` }, { status: 400 });
    }
  }

  const target = await prisma.guardianTarget.create({
    data: {
      projectId: ctx.projectId,
      name,
      type: body.type,
      url,
      description: body.description?.trim() || null,
      verificationToken: body.type === "URL" ? newVerificationToken() : null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "GUARDIAN_TARGET_CREADO",
      entidad: `GuardianTarget:${target.id}`,
      detalle: `${target.type}: ${target.name}`,
    },
  });

  return NextResponse.json(target);
}

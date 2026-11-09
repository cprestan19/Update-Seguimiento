import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { prisma } from "@/lib/prisma";
import type { GuardianScanType } from "@prisma/client";
import { getProjectContext } from "@/lib/projectContext";
import { runScan } from "@/lib/guardian/engine";

// El escaneo puede tardar (consultas OSV, múltiples peticiones). Se crea la
// fila, se devuelve de inmediato y se ejecuta en segundo plano con waitUntil;
// el cliente consulta el estado por /api/guardian/scans/[id].
export const maxDuration = 300;

const TYPES_BY_PROFILE: Record<"URL" | "REPO", Record<"SAFE" | "FULL", GuardianScanType[]>> = {
  URL: {
    SAFE: ["URL_HEADERS"],
    FULL: ["URL_HEADERS", "URL_EXPOSURE"],
  },
  REPO: {
    SAFE: ["REPO_DEPS", "REPO_SECRETS", "REPO_SAST"],
    FULL: ["REPO_DEPS", "REPO_SECRETS", "REPO_SAST"],
  },
};

export async function GET(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const targetId = new URL(req.url).searchParams.get("targetId");
  if (!targetId) return NextResponse.json({ error: "Falta targetId" }, { status: 400 });

  const target = await prisma.guardianTarget.findFirst({ where: { id: targetId, projectId: ctx.projectId } });
  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });

  const scans = await prisma.guardianScan.findMany({
    where: { targetId },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(scans);
}

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") return NextResponse.json({ error: "El rol Monitor solo puede ver" }, { status: 403 });

  const { targetId, profile } = (await req.json().catch(() => ({}))) as {
    targetId?: string;
    profile?: "SAFE" | "FULL";
  };
  const prof = profile === "FULL" ? "FULL" : "SAFE";

  if (!targetId) return NextResponse.json({ error: "Falta targetId" }, { status: 400 });
  const target = await prisma.guardianTarget.findFirst({ where: { id: targetId, projectId: ctx.projectId } });
  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });

  const authorized = target.verification === "VERIFIED" || target.verification === "AUTHORIZED";
  if (prof === "FULL" && target.type === "URL" && !authorized) {
    return NextResponse.json(
      { error: "El perfil FULL (pruebas intrusivas) requiere verificar la propiedad del dominio o registrar una autorización." },
      { status: 403 }
    );
  }

  const types = TYPES_BY_PROFILE[target.type][prof];

  const scan = await prisma.guardianScan.create({
    data: {
      targetId: target.id,
      profile: prof,
      types,
      status: "QUEUED",
      startedById: ctx.userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "GUARDIAN_SCAN_INICIADO",
      entidad: `GuardianScan:${scan.id}`,
      detalle: `${target.name} (${prof})`,
    },
  });

  // Ejecuta en segundo plano; la respuesta vuelve ya.
  waitUntil(runScan(scan.id));

  return NextResponse.json({ id: scan.id, status: scan.status });
}

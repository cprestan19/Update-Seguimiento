import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";
import { copyChecklistTemplate } from "@/lib/storeChecklist";

// Plantilla de checklist del proyecto activo:
//   GET  -> secciones con sus criterios de proyecto/región (+ cuántas tiendas
//           tiene cada uno), las regiones del proyecto y los proyectos desde
//           los que se puede importar.
//   POST -> importar la plantilla de otro proyecto { fromProjectId } (ADMIN
//           de ambos proyectos, o super admin).

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const [secciones, stores, importables] = await Promise.all([
    prisma.checklistCategory.findMany({
      where: { projectId: ctx.projectId },
      orderBy: { orden: "asc" },
      include: {
        items: {
          where: { storeId: null },
          orderBy: { orden: "asc" },
          select: { id: true, nombre: true, tipo: true, region: true, _count: { select: { storeItems: true } } },
        },
      },
    }),
    prisma.store.findMany({ where: { projectId: ctx.projectId }, select: { region: true } }),
    prisma.projectMember.findMany({
      where: {
        userId: ctx.userId,
        role: "ADMIN",
        projectId: { not: ctx.projectId },
        project: { active: true },
      },
      select: { project: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return NextResponse.json({
    totalTiendas: stores.length,
    regiones: [...new Set(stores.map((s) => s.region))].sort((a, b) => a.localeCompare(b, "es")),
    secciones: secciones.map((s) => ({
      id: s.id,
      nombre: s.nombre,
      items: s.items.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        tipo: i.tipo,
        region: i.region,
        tiendas: i._count.storeItems,
      })),
    })),
    importables: importables.map((m) => m.project),
  });
}

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede importar plantillas" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { fromProjectId?: unknown };
  const fromProjectId = typeof body.fromProjectId === "string" ? body.fromProjectId : "";
  if (!fromProjectId || fromProjectId === ctx.projectId) {
    return NextResponse.json({ error: "Elige el proyecto de origen" }, { status: 400 });
  }

  if (!ctx.isSuperAdmin) {
    const member = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: fromProjectId, userId: ctx.userId } },
      select: { role: true },
    });
    if (member?.role !== "ADMIN") {
      return NextResponse.json({ error: "Debes ser administrador del proyecto de origen" }, { status: 403 });
    }
  }

  const copiados = await copyChecklistTemplate(fromProjectId, ctx.projectId);
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_PLANTILLA_IMPORTADA",
      detalle: JSON.stringify({ fromProjectId, copiados }),
    },
  });
  return NextResponse.json({ ok: true, copiados });
}

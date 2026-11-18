import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";
import { pruneEmptySections, recalcularTiendas } from "@/lib/storeChecklist";

// Editar o eliminar la DEFINICIÓN de un criterio: el cambio aplica en todas
// las tiendas que lo tienen (solo ADMIN).

async function loadDef(id: string, projectId: string) {
  return prisma.checklistItemDef.findFirst({
    where: { id, category: { projectId } },
    include: { storeItems: { select: { storeId: true } } },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar criterios" }, { status: 403 });
  }

  const def = await loadDef(params.id, ctx.projectId);
  if (!def) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { nombre?: unknown };
  const nombre = typeof body.nombre === "string" ? body.nombre.trim() : "";
  if (!nombre || nombre.length > 200) {
    return NextResponse.json({ error: "Escribe un nombre válido" }, { status: 400 });
  }

  await prisma.checklistItemDef.update({ where: { id: def.id }, data: { nombre } });
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_CRITERIO_RENOMBRADO",
      entidad: `ChecklistItemDef:${def.id}`,
      detalle: `${def.nombre} -> ${nombre}`,
    },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede eliminar criterios" }, { status: 403 });
  }

  const def = await loadDef(params.id, ctx.projectId);
  if (!def) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });

  const afectadas = def.storeItems.map((s) => s.storeId);
  await prisma.checklistItemDef.delete({ where: { id: def.id } });
  await pruneEmptySections(ctx.projectId);
  await recalcularTiendas(afectadas);
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_CRITERIO_ELIMINADO",
      entidad: `ChecklistItemDef:${def.id}`,
      detalle: `${def.nombre} (en ${afectadas.length} tiendas)`,
    },
  });
  return NextResponse.json({ ok: true, tiendas: afectadas.length });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalcularEstadoTienda } from "@/lib/storeStatus";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";
import {
  addChecklistItem,
  recalcularTiendas,
  pruneEmptySections,
  CHECKLIST_TIPOS,
  type ChecklistScope,
  type ChecklistTipo,
} from "@/lib/storeChecklist";

// Criterios del checklist de las tiendas/categorías:
//   POST   -> agregar criterio con alcance STORE / REGION / PROJECT (ADMIN)
//   PATCH  -> guardar el valor de un criterio DATO / NOTA (cualquier no-Monitor)
//   DELETE -> quitar un criterio de UNA tienda (ADMIN)
// Renombrar o eliminar un criterio en todas las tiendas: /api/checklist/defs/[id].

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede agregar criterios" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const storeId = str(body.storeId);
  const nombre = str(body.nombre);
  const seccion = str(body.seccion);
  const alcance = str(body.alcance) || "STORE";
  const tipo = (CHECKLIST_TIPOS as readonly string[]).includes(body.tipo as string)
    ? (body.tipo as ChecklistTipo)
    : "CHECK";

  if (!nombre || !seccion) {
    return NextResponse.json({ error: "Escribe el criterio y la sección" }, { status: 400 });
  }
  if (nombre.length > 200 || seccion.length > 100) {
    return NextResponse.json({ error: "Texto demasiado largo" }, { status: 400 });
  }

  const store = storeId
    ? await prisma.store.findFirst({ where: { id: storeId, projectId: ctx.projectId } })
    : null;

  let scope: ChecklistScope;
  if (alcance === "PROJECT") {
    scope = { kind: "PROJECT" };
  } else if (alcance === "REGION") {
    const region = str(body.region) || store?.region || "";
    if (!region) return NextResponse.json({ error: "Indica la región" }, { status: 400 });
    scope = { kind: "REGION", region };
  } else {
    if (!store) return NextResponse.json({ error: "Categoría no encontrada" }, { status: 404 });
    scope = { kind: "STORE", storeId: store.id };
  }

  const { def, storeIds } = await addChecklistItem({ projectId: ctx.projectId, seccion, nombre, tipo, scope });
  await recalcularTiendas(storeIds);
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_CRITERIO_AGREGADO",
      entidad: def ? `ChecklistItemDef:${def.id}` : null,
      detalle: JSON.stringify({ seccion, nombre, tipo, alcance: scope, tiendas: storeIds.length }),
    },
  });
  return NextResponse.json({ ok: true, id: def?.id, tiendas: storeIds.length });
}

export async function PATCH(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { storeChecklistItemId?: unknown; valor?: unknown };
  const id = typeof body.storeChecklistItemId === "string" ? body.storeChecklistItemId : "";
  const valor = typeof body.valor === "string" ? body.valor.trim() : "";
  if (valor.length > 5000) return NextResponse.json({ error: "Texto demasiado largo" }, { status: 400 });

  const current = await prisma.storeChecklistItem.findFirst({
    where: { id, store: { projectId: ctx.projectId } },
    include: { itemDef: { select: { tipo: true, nombre: true } } },
  });
  if (!current) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });
  if (current.itemDef.tipo === "CHECK") {
    return NextResponse.json({ error: "Este criterio es una casilla" }, { status: 400 });
  }

  // DATO cuenta como completado cuando tiene valor; NOTA siempre está
  // "completada" para no bloquear el progreso.
  const completado = current.itemDef.tipo === "NOTA" ? true : valor.length > 0;
  const updated = await prisma.storeChecklistItem.update({
    where: { id },
    data: {
      valor: valor || null,
      completado,
      completadoPorId: completado && valor ? ctx.userId : null,
      completadoEn: completado && valor ? new Date() : null,
    },
  });

  await recalcularEstadoTienda(current.storeId);
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_VALOR",
      entidad: `StoreChecklistItem:${id}`,
      detalle: `${current.itemDef.nombre}: ${valor.slice(0, 200)}`,
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede quitar criterios" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { storeChecklistItemId?: unknown };
  const id = typeof body.storeChecklistItemId === "string" ? body.storeChecklistItemId : "";

  const current = await prisma.storeChecklistItem.findFirst({
    where: { id, store: { projectId: ctx.projectId } },
    include: { itemDef: { select: { id: true, storeId: true, nombre: true } } },
  });
  if (!current) return NextResponse.json({ error: "Criterio no encontrado" }, { status: 404 });

  // Criterio propio de esta tienda: se borra la definición completa. Criterio
  // de proyecto/región: solo se quita de esta tienda; las demás lo conservan.
  if (current.itemDef.storeId) {
    await prisma.checklistItemDef.delete({ where: { id: current.itemDef.id } });
    await pruneEmptySections(ctx.projectId);
  } else {
    await prisma.storeChecklistItem.delete({ where: { id } });
  }

  await recalcularEstadoTienda(current.storeId);
  await publishChange("stores", ctx.projectId);
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "CHECKLIST_CRITERIO_QUITADO",
      entidad: `Store:${current.storeId}`,
      detalle: current.itemDef.nombre,
    },
  });
  return NextResponse.json({ ok: true });
}

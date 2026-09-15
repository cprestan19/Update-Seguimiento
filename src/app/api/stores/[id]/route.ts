import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext, isProjectMember } from "@/lib/projectContext";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const store = await prisma.store.findFirst({
    where: { id: params.id, projectId: ctx.projectId },
    include: {
      tecnico: { select: { id: true, name: true } },
      auditorTI: { select: { id: true, name: true } },
      auditorInv: { select: { id: true, name: true } },
      checklist: {
        include: { itemDef: { include: { category: true } }, completadoPor: { select: { name: true } } },
      },
      incidents: { include: { createdBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!store) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  return NextResponse.json(store);
}

// Reasignar personal (solo ADMIN) y/o registrar inventario inicial/final (cualquier usuario autenticado)
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const existente = await prisma.store.findFirst({ where: { id: params.id, projectId: ctx.projectId } });
  if (!existente) return NextResponse.json({ error: "Tienda no encontrada" }, { status: 404 });

  const body = await req.json();
  const {
    tecnicoId,
    auditorTIId,
    auditorInvId,
    inventarioInicial,
    inventarioFinal,
    costoInicial,
    costoFinal,
    inicioReal,
  } = body as {
    tecnicoId?: string | null;
    auditorTIId?: string | null;
    auditorInvId?: string | null;
    inventarioInicial?: number | string | null;
    inventarioFinal?: number | string | null;
    costoInicial?: number | string | null;
    costoFinal?: number | string | null;
    inicioReal?: string | null;
  };

  const data: Record<string, unknown> = {};
  const auditDetalle: Record<string, unknown> = {};

  const reasignando = tecnicoId !== undefined || auditorTIId !== undefined || auditorInvId !== undefined;
  if (reasignando) {
    for (const [campo, valor] of [
      ["tecnicoId", tecnicoId],
      ["auditorTIId", auditorTIId],
      ["auditorInvId", auditorInvId],
    ] as const) {
      if (valor === undefined) continue;
      if (valor && !(await isProjectMember(ctx.projectId, valor))) {
        return NextResponse.json({ error: "Esa persona no pertenece a este proyecto" }, { status: 400 });
      }
      data[campo] = valor === "" ? null : valor;
    }
    auditDetalle.tecnicoId = tecnicoId;
    auditDetalle.auditorTIId = auditorTIId;
    auditDetalle.auditorInvId = auditorInvId;
  }

  function parseInventario(v: number | string | null | undefined) {
    if (v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n) : null;
  }

  if (inventarioInicial !== undefined) {
    data.inventarioInicial = parseInventario(inventarioInicial);
    auditDetalle.inventarioInicial = data.inventarioInicial;
  }
  if (inventarioFinal !== undefined) {
    data.inventarioFinal = parseInventario(inventarioFinal);
    auditDetalle.inventarioFinal = data.inventarioFinal;
  }

  function parseCosto(v: number | string | null | undefined) {
    if (v === "" || v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
  }

  if (costoInicial !== undefined) {
    data.costoInicial = parseCosto(costoInicial);
    auditDetalle.costoInicial = data.costoInicial;
  }
  if (costoFinal !== undefined) {
    data.costoFinal = parseCosto(costoFinal);
    auditDetalle.costoFinal = data.costoFinal;
  }

  if (inicioReal !== undefined) {
    const nuevoInicio = inicioReal ? new Date(inicioReal) : null;
    data.inicioReal = nuevoInicio;
    auditDetalle.inicioReal = nuevoInicio;

    if (existente.finReal && nuevoInicio) {
      data.duracionRealMin = Math.round((existente.finReal.getTime() - nuevoInicio.getTime()) / 60000);
    }
  }

  const store = await prisma.store.update({ where: { id: params.id }, data });
  await publishChange("stores", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: reasignando ? "ASIGNACION" : "INVENTARIO_ACTUALIZADO",
      entidad: `Store:${store.id}`,
      detalle: JSON.stringify(auditDetalle),
    },
  });

  return NextResponse.json(store);
}

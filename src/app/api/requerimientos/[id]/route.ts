import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext, isProjectMember } from "@/lib/projectContext";
import { calcularSla } from "@/lib/requirementSla";
import {
  validarArea,
  validarEstado,
  validarImpacto,
  validarPrioridad,
  validarTipo,
  validarAlcanceAfectados,
  validarRiesgo,
  parseFechaValida,
} from "@/lib/requirementValidation";
import type { Prisma } from "@prisma/client";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const requirement = await prisma.requirement.findFirst({
    where: { id: params.id, projectId: ctx.projectId, activo: true },
    include: {
      liderProyecto: { select: { id: true, name: true } },
      responsableTecnico: { select: { id: true, name: true } },
      responsableDependencia: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      activities: {
        orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!requirement) return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });

  return NextResponse.json({
    ...requirement,
    sla: calcularSla(requirement.fechaEstimadaEntrega, requirement.fechaRealEntrega, requirement.estado),
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const existente = await prisma.requirement.findFirst({
    where: { id: params.id, projectId: ctx.projectId, activo: true },
  });
  if (!existente) return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });

  const body = await req.json();
  const data: Prisma.RequirementUpdateInput = {};
  const activitiesToCreate: Prisma.RequirementActivityCreateWithoutRequirementInput[] = [];

  function setText(field: keyof typeof body, target: string) {
    if (body[field] === undefined) return;
    (data as Record<string, unknown>)[target] = body[field] ? String(body[field]).trim() : null;
  }

  if (body.titulo !== undefined) {
    if (!String(body.titulo).trim()) return NextResponse.json({ error: "El título no puede quedar vacío" }, { status: 400 });
    data.titulo = String(body.titulo).trim();
  }
  if (body.descripcion !== undefined) {
    if (!String(body.descripcion).trim())
      return NextResponse.json({ error: "La descripción no puede quedar vacía" }, { status: 400 });
    data.descripcion = String(body.descripcion).trim();
  }
  setText("objetivo", "objetivo");
  setText("alcance", "alcance");
  setText("fueraDeAlcance", "fueraDeAlcance");
  setText("criteriosAceptacion", "criteriosAceptacion");
  setText("explicacionTecnica", "explicacionTecnica");
  setText("solicitadoPorNombre", "solicitadoPorNombre");
  setText("departamentoSolicitante", "departamentoSolicitante");
  setText("gerenteDepartamento", "gerenteDepartamento");
  setText("observaciones", "observaciones");
  setText("motivoBloqueo", "motivoBloqueo");
  setText("motivoRiesgo", "motivoRiesgo");
  setText("alcanceAfectadosDetalle", "alcanceAfectadosDetalle");

  if (body.liderProyectoId !== undefined) {
    const v = body.liderProyectoId ? String(body.liderProyectoId) : null;
    if (v && !(await isProjectMember(ctx.projectId, v))) {
      return NextResponse.json({ error: "El líder de proyecto debe ser miembro de este proyecto" }, { status: 400 });
    }
    if (!v) return NextResponse.json({ error: "El líder de proyecto es obligatorio" }, { status: 400 });
    if (v !== existente.liderProyectoId) {
      activitiesToCreate.push({
        tipo: "CAMBIO_RESPONSABLE",
        descripcion: "Se cambió el líder de proyecto",
        metadata: { anterior: existente.liderProyectoId, nuevo: v },
        user: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      });
    }
    data.liderProyecto = { connect: { id: v } };
  }

  if (body.responsableTecnicoId !== undefined) {
    const v = body.responsableTecnicoId ? String(body.responsableTecnicoId) : null;
    if (v && !(await isProjectMember(ctx.projectId, v))) {
      return NextResponse.json({ error: "El responsable técnico debe ser miembro de este proyecto" }, { status: 400 });
    }
    if (v !== (existente.responsableTecnicoId || null)) {
      activitiesToCreate.push({
        tipo: "CAMBIO_RESPONSABLE",
        descripcion: "Se cambió el responsable técnico",
        metadata: { anterior: existente.responsableTecnicoId, nuevo: v },
        user: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      });
    }
    data.responsableTecnico = v ? { connect: { id: v } } : { disconnect: true };
  }

  if (body.responsableDependenciaId !== undefined) {
    const v = body.responsableDependenciaId ? String(body.responsableDependenciaId) : null;
    if (v && !(await isProjectMember(ctx.projectId, v))) {
      return NextResponse.json(
        { error: "El responsable de la dependencia debe ser miembro de este proyecto" },
        { status: 400 }
      );
    }
    data.responsableDependencia = v ? { connect: { id: v } } : { disconnect: true };
  }

  if (body.tipo !== undefined) {
    if (!validarTipo(body.tipo)) return NextResponse.json({ error: "Tipo inválido" }, { status: 400 });
    data.tipo = body.tipo;
  }
  if (body.area !== undefined) {
    if (!validarArea(body.area)) return NextResponse.json({ error: "Área inválida" }, { status: 400 });
    data.area = body.area;
  }
  if (body.prioridad !== undefined) {
    if (!validarPrioridad(body.prioridad)) return NextResponse.json({ error: "Prioridad inválida" }, { status: 400 });
    if (body.prioridad !== existente.prioridad) {
      activitiesToCreate.push({
        tipo: "CAMBIO_PRIORIDAD",
        descripcion: "Se cambió la prioridad",
        metadata: { anterior: existente.prioridad, nuevo: body.prioridad },
        user: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      });
    }
    data.prioridad = body.prioridad;
  }
  if (body.estado !== undefined) {
    if (!validarEstado(body.estado)) return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
    if (body.estado !== existente.estado) {
      activitiesToCreate.push({
        tipo: body.estado === "IMPLEMENTADO" || body.estado === "CERRADO" ? "CIERRE" : "CAMBIO_ESTADO",
        descripcion: `Estado: ${existente.estado} → ${body.estado}`,
        metadata: { anterior: existente.estado, nuevo: body.estado },
        user: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      });
    }
    data.estado = body.estado;
  }
  if (body.impacto !== undefined) {
    if (!validarImpacto(body.impacto)) return NextResponse.json({ error: "Impacto inválido" }, { status: 400 });
    data.impacto = body.impacto;
  }
  if (body.riesgo !== undefined) {
    if (body.riesgo && !validarRiesgo(body.riesgo)) return NextResponse.json({ error: "Riesgo inválido" }, { status: 400 });
    data.riesgo = body.riesgo || null;
  }
  if (body.alcanceAfectados !== undefined) {
    if (body.alcanceAfectados && !validarAlcanceAfectados(body.alcanceAfectados)) {
      return NextResponse.json({ error: "Alcance de afectados inválido" }, { status: 400 });
    }
    data.alcanceAfectados = body.alcanceAfectados || null;
  }

  if (body.bloqueado !== undefined) data.bloqueado = Boolean(body.bloqueado);
  if (body.dependenciaExterna !== undefined) data.dependenciaExterna = Boolean(body.dependenciaExterna);
  if (body.dependenciaInterna !== undefined) data.dependenciaInterna = Boolean(body.dependenciaInterna);
  if (body.camposArea !== undefined) data.camposArea = body.camposArea;
  if (body.implementacion !== undefined) data.implementacion = body.implementacion;

  if (body.fechaRealEntrega !== undefined) {
    if (body.fechaRealEntrega) {
      const d = parseFechaValida(body.fechaRealEntrega);
      if (!d) return NextResponse.json({ error: "Fecha real de entrega inválida" }, { status: 400 });
      if (d < existente.fechaSolicitud) {
        return NextResponse.json(
          { error: "La fecha real de entrega no puede ser anterior a la fecha de solicitud" },
          { status: 400 }
        );
      }
      data.fechaRealEntrega = d;
    } else {
      data.fechaRealEntrega = null;
    }
  }

  if (body.fechaEstimadaEntrega !== undefined) {
    const d = parseFechaValida(body.fechaEstimadaEntrega);
    if (!d) return NextResponse.json({ error: "Fecha estimada de entrega inválida" }, { status: 400 });
    if (d < existente.fechaSolicitud) {
      return NextResponse.json(
        { error: "La fecha estimada de entrega no puede ser anterior a la fecha de solicitud" },
        { status: 400 }
      );
    }
    const cambio = d.getTime() !== existente.fechaEstimadaEntrega.getTime();
    if (cambio) {
      const motivo = String(body.motivoCambioFecha || "").trim();
      if (!motivo) {
        return NextResponse.json(
          { error: "Debes indicar un motivo para cambiar la fecha estimada de entrega" },
          { status: 400 }
        );
      }
      activitiesToCreate.push({
        tipo: "FECHA_MODIFICADA",
        descripcion: `Fecha estimada de entrega modificada: ${motivo}`,
        metadata: {
          fechaAnterior: existente.fechaEstimadaEntrega.toISOString(),
          fechaNueva: d.toISOString(),
          motivo,
        },
        user: ctx.userId ? { connect: { id: ctx.userId } } : undefined,
      });
    }
    data.fechaEstimadaEntrega = d;
  }

  if (activitiesToCreate.length > 0) {
    data.activities = { create: activitiesToCreate };
  }

  const requirement = await prisma.requirement.update({ where: { id: existente.id }, data });
  await publishChange("requerimientos", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "REQUERIMIENTO_ACTUALIZADO",
      entidad: `Requirement:${requirement.id}`,
      detalle: `${requirement.numero}`,
    },
  });

  return NextResponse.json(requirement);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede eliminar requerimientos" }, { status: 403 });
  }

  const existente = await prisma.requirement.findFirst({
    where: { id: params.id, projectId: ctx.projectId, activo: true },
  });
  if (!existente) return NextResponse.json({ error: "Requerimiento no encontrado" }, { status: 404 });

  // Soft delete: se conserva la fila y todo su historial de actividades.
  await prisma.requirement.update({
    where: { id: existente.id },
    data: {
      activo: false,
      eliminadoEn: new Date(),
      activities: {
        create: {
          tipo: "ELIMINACION",
          descripcion: "Requerimiento eliminado",
          userId: ctx.userId,
        },
      },
    },
  });
  await publishChange("requerimientos", ctx.projectId);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "REQUERIMIENTO_ELIMINADO",
      entidad: `Requirement:${existente.id}`,
      detalle: existente.numero,
    },
  });

  return NextResponse.json({ ok: true });
}

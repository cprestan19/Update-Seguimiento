import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext, isProjectMember } from "@/lib/projectContext";
import { getNextRequirementNumber } from "@/lib/requirementNumbering";
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

export async function GET(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const url = new URL(req.url);
  const params = url.searchParams;

  const where: Record<string, unknown> = { projectId: ctx.projectId, activo: true };
  const estado = params.get("estado");
  if (estado) where.estado = estado;
  const prioridad = params.get("prioridad");
  if (prioridad) where.prioridad = prioridad;
  const tipo = params.get("tipo");
  if (tipo) where.tipo = tipo;
  const area = params.get("area");
  if (area) where.area = area;
  const departamentoSolicitante = params.get("departamentoSolicitante");
  if (departamentoSolicitante) where.departamentoSolicitante = departamentoSolicitante;
  const responsableTecnicoId = params.get("responsableTecnicoId");
  if (responsableTecnicoId) where.responsableTecnicoId = responsableTecnicoId;
  const liderProyectoId = params.get("liderProyectoId");
  if (liderProyectoId) where.liderProyectoId = liderProyectoId;

  const q = params.get("q")?.trim();
  if (q) {
    where.OR = [
      { numero: { contains: q, mode: "insensitive" } },
      { titulo: { contains: q, mode: "insensitive" } },
      { descripcion: { contains: q, mode: "insensitive" } },
    ];
  }

  const rows = await prisma.requirement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      liderProyecto: { select: { id: true, name: true } },
      responsableTecnico: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  const vencidosOnly = params.get("vencidos") === "true";
  const proximosOnly = params.get("proximosAVencer") === "true";

  const data = rows
    .map((r) => ({
      id: r.id,
      numero: r.numero,
      titulo: r.titulo,
      tipo: r.tipo,
      area: r.area,
      prioridad: r.prioridad,
      estado: r.estado,
      impacto: r.impacto,
      bloqueado: r.bloqueado,
      departamentoSolicitante: r.departamentoSolicitante,
      liderProyecto: r.liderProyecto,
      responsableTecnico: r.responsableTecnico,
      fechaSolicitud: r.fechaSolicitud,
      fechaEstimadaEntrega: r.fechaEstimadaEntrega,
      fechaRealEntrega: r.fechaRealEntrega,
      sla: calcularSla(r.fechaEstimadaEntrega, r.fechaRealEntrega, r.estado, now),
      createdAt: r.createdAt,
    }))
    .filter((r) => (vencidosOnly ? r.sla.vencido : true))
    .filter((r) => (proximosOnly ? r.sla.proximoAVencer : true));

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") {
    return NextResponse.json({ error: "El rol Monitor solo puede ver, no editar" }, { status: 403 });
  }

  const body = await req.json();
  const {
    titulo,
    descripcion,
    objetivo,
    alcance,
    fueraDeAlcance,
    criteriosAceptacion,
    solicitadoPorNombre,
    departamentoSolicitante,
    gerenteDepartamento,
    liderProyectoId,
    responsableTecnicoId,
    observaciones,
    fechaSolicitud,
    fechaEstimadaEntrega,
    fechaRealEntrega,
    tipo,
    area,
    prioridad,
    estado,
    impacto,
    alcanceAfectados,
    alcanceAfectadosDetalle,
    bloqueado,
    motivoBloqueo,
    dependenciaExterna,
    dependenciaInterna,
    responsableDependenciaId,
    riesgo,
    motivoRiesgo,
    camposArea,
    implementacion,
  } = body as Record<string, unknown>;

  if (
    !String(titulo || "").trim() ||
    !String(descripcion || "").trim() ||
    !String(solicitadoPorNombre || "").trim() ||
    !String(departamentoSolicitante || "").trim() ||
    !String(liderProyectoId || "").trim()
  ) {
    return NextResponse.json(
      { error: "Título, descripción, solicitado por, departamento solicitante y líder de proyecto son obligatorios" },
      { status: 400 }
    );
  }

  if (!validarTipo(tipo) || !validarArea(area) || !validarPrioridad(prioridad)) {
    return NextResponse.json({ error: "Tipo, área y prioridad son obligatorios y deben ser válidos" }, { status: 400 });
  }
  if (estado !== undefined && !validarEstado(estado)) {
    return NextResponse.json({ error: "Estado inválido" }, { status: 400 });
  }
  if (impacto !== undefined && impacto !== null && !validarImpacto(impacto)) {
    return NextResponse.json({ error: "Impacto inválido" }, { status: 400 });
  }
  if (riesgo !== undefined && riesgo !== null && riesgo !== "" && !validarRiesgo(riesgo)) {
    return NextResponse.json({ error: "Riesgo inválido" }, { status: 400 });
  }
  if (
    alcanceAfectados !== undefined &&
    alcanceAfectados !== null &&
    alcanceAfectados !== "" &&
    !validarAlcanceAfectados(alcanceAfectados)
  ) {
    return NextResponse.json({ error: "Alcance de afectados inválido" }, { status: 400 });
  }

  const dSolicitud = parseFechaValida(fechaSolicitud);
  const dEstimada = parseFechaValida(fechaEstimadaEntrega);
  if (!dSolicitud || !dEstimada) {
    return NextResponse.json({ error: "Fecha de solicitud y fecha estimada de entrega son obligatorias" }, { status: 400 });
  }
  if (dEstimada < dSolicitud) {
    return NextResponse.json(
      { error: "La fecha estimada de entrega no puede ser anterior a la fecha de solicitud" },
      { status: 400 }
    );
  }
  let dReal: Date | null = null;
  if (fechaRealEntrega) {
    dReal = parseFechaValida(fechaRealEntrega);
    if (!dReal) return NextResponse.json({ error: "Fecha real de entrega inválida" }, { status: 400 });
    if (dReal < dSolicitud) {
      return NextResponse.json(
        { error: "La fecha real de entrega no puede ser anterior a la fecha de solicitud" },
        { status: 400 }
      );
    }
  }

  if (!(await isProjectMember(ctx.projectId, String(liderProyectoId)))) {
    return NextResponse.json({ error: "El líder de proyecto debe ser miembro de este proyecto" }, { status: 400 });
  }
  if (responsableTecnicoId && !(await isProjectMember(ctx.projectId, String(responsableTecnicoId)))) {
    return NextResponse.json({ error: "El responsable técnico debe ser miembro de este proyecto" }, { status: 400 });
  }
  if (responsableDependenciaId && !(await isProjectMember(ctx.projectId, String(responsableDependenciaId)))) {
    return NextResponse.json({ error: "El responsable de la dependencia debe ser miembro de este proyecto" }, { status: 400 });
  }

  const numero = await getNextRequirementNumber(ctx.projectId);

  const requirement = await prisma.requirement.create({
    data: {
      projectId: ctx.projectId,
      numero,
      titulo: String(titulo).trim(),
      descripcion: String(descripcion).trim(),
      objetivo: objetivo ? String(objetivo).trim() : null,
      alcance: alcance ? String(alcance).trim() : null,
      fueraDeAlcance: fueraDeAlcance ? String(fueraDeAlcance).trim() : null,
      criteriosAceptacion: criteriosAceptacion ? String(criteriosAceptacion).trim() : null,
      solicitadoPorNombre: String(solicitadoPorNombre).trim(),
      departamentoSolicitante: String(departamentoSolicitante).trim(),
      gerenteDepartamento: gerenteDepartamento ? String(gerenteDepartamento).trim() : null,
      liderProyectoId: String(liderProyectoId),
      responsableTecnicoId: responsableTecnicoId ? String(responsableTecnicoId) : null,
      observaciones: observaciones ? String(observaciones).trim() : null,
      fechaSolicitud: dSolicitud,
      fechaEstimadaEntrega: dEstimada,
      fechaRealEntrega: dReal,
      tipo: tipo as never,
      area: area as never,
      prioridad: prioridad as never,
      estado: (estado as never) || undefined,
      impacto: (impacto as never) || undefined,
      alcanceAfectados: (alcanceAfectados as never) || null,
      alcanceAfectadosDetalle: alcanceAfectadosDetalle ? String(alcanceAfectadosDetalle).trim() : null,
      bloqueado: Boolean(bloqueado),
      motivoBloqueo: motivoBloqueo ? String(motivoBloqueo).trim() : null,
      dependenciaExterna: Boolean(dependenciaExterna),
      dependenciaInterna: Boolean(dependenciaInterna),
      responsableDependenciaId: responsableDependenciaId ? String(responsableDependenciaId) : null,
      riesgo: (riesgo as never) || null,
      motivoRiesgo: motivoRiesgo ? String(motivoRiesgo).trim() : null,
      camposArea: (camposArea as never) ?? undefined,
      implementacion: (implementacion as never) ?? undefined,
      createdById: ctx.userId,
      activities: {
        create: {
          tipo: "CREACION",
          descripcion: "Requerimiento creado",
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
      accion: "REQUERIMIENTO_CREADO",
      entidad: `Requirement:${requirement.id}`,
      detalle: `${requirement.numero} — ${requirement.titulo}`,
    },
  });

  return NextResponse.json(requirement);
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";

// Adjunta una persona que YA existe en el sistema (de otro proyecto, o sin
// proyecto) al proyecto activo, con su propio rol dentro de este proyecto.
export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede agregar personas" }, { status: 403 });
  }

  const { userId, role, personnelRole, pais } = (await req.json()) as {
    userId: string;
    role: "ADMIN" | "USER" | "MONITOR";
    personnelRole?: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
    pais?: string | null;
  };

  if (!userId) return NextResponse.json({ error: "Falta la persona a agregar" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.active) {
    return NextResponse.json({ error: "Esa persona no existe o está inactiva" }, { status: 404 });
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: ctx.projectId, userId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Esa persona ya es parte de este proyecto" }, { status: 409 });
  }

  const member = await prisma.projectMember.create({
    data: {
      projectId: ctx.projectId,
      userId,
      role: role || "USER",
      personnelRole: personnelRole || null,
      pais: pais || null,
    },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "USUARIO_AGREGADO_AL_PROYECTO",
      detalle: `Agregado: ${user.username}`,
    },
  });

  return NextResponse.json({
    id: user.id,
    name: user.name,
    username: user.username,
    role: member.role,
    personnelRole: member.personnelRole,
    pais: member.pais,
  });
}

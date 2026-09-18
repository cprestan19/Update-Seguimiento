import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

// Edita datos de una persona del proyecto activo (nombre/usuario/contraseña
// son globales del login; rol/rol funcional/país son propios de este
// proyecto, viven en su ProjectMember).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar personal" }, { status: 403 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: ctx.projectId, userId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: "Esa persona no es parte de este proyecto" }, { status: 404 });

  const body = await req.json();
  const { name, username, password, role, personnelRole, pais, active } = body as {
    name?: string;
    username?: string;
    password?: string;
    role?: "ADMIN" | "USER" | "MONITOR";
    personnelRole?: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
    pais?: string | null;
    active?: boolean;
  };

  const userData: Record<string, unknown> = {};

  // Dar de baja / reactivar: solo bloquea el login. Se conservan su
  // membresia y todas sus asignaciones historicas en tiendas y seguimiento.
  if (active !== undefined) {
    if (ctx.userId === params.id && !active) {
      return NextResponse.json({ error: "No puedes darte de baja a ti mismo" }, { status: 400 });
    }
    userData.active = active;
  }

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    userData.name = name.trim();
  }

  if (username !== undefined) {
    if (!username.trim()) return NextResponse.json({ error: "El usuario no puede estar vacío" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
    }
    userData.username = username.trim();
  }

  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    userData.passwordHash = await bcrypt.hash(password, 10);
  }

  const memberData: Record<string, unknown> = {};
  if (role !== undefined) {
    if (ctx.userId === params.id && role !== "ADMIN") {
      return NextResponse.json({ error: "No puedes quitarte tu propio rol de administrador" }, { status: 400 });
    }
    memberData.role = role;
  }
  if (personnelRole !== undefined) memberData.personnelRole = personnelRole || null;
  if (pais !== undefined) memberData.pais = pais || null;

  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id: params.id },
      data: userData,
      select: { id: true, name: true, username: true },
    }),
    ...(Object.keys(memberData).length
      ? [
          prisma.projectMember.update({
            where: { projectId_userId: { projectId: ctx.projectId, userId: params.id } },
            data: memberData,
          }),
        ]
      : []),
  ]);

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: active === undefined ? "USUARIO_EDITADO" : active ? "USUARIO_REACTIVADO" : "USUARIO_DADO_DE_BAJA",
      detalle: JSON.stringify({ id: user.id, username: user.username }),
    },
  });
  await publishChange("users", ctx.projectId);

  return NextResponse.json(user);
}

// Quita a la persona del proyecto activo (no borra su cuenta global — puede
// seguir perteneciendo a otros proyectos) y la desasigna de las tiendas de
// este proyecto.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede quitar personal" }, { status: 403 });
  }
  if (ctx.userId === params.id) {
    return NextResponse.json({ error: "No puedes quitarte a ti mismo del proyecto" }, { status: 400 });
  }

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: ctx.projectId, userId: params.id } },
  });
  if (!membership) return NextResponse.json({ error: "Esa persona no es parte de este proyecto" }, { status: 404 });

  await prisma.store.updateMany({
    where: { projectId: ctx.projectId, tecnicoId: params.id },
    data: { tecnicoId: null },
  });
  await prisma.store.updateMany({
    where: { projectId: ctx.projectId, auditorTIId: params.id },
    data: { auditorTIId: null },
  });
  await prisma.store.updateMany({
    where: { projectId: ctx.projectId, auditorInvId: params.id },
    data: { auditorInvId: null },
  });

  const user = await prisma.user.findUnique({ where: { id: params.id }, select: { username: true } });
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: ctx.projectId, userId: params.id } },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "USUARIO_QUITADO_DEL_PROYECTO",
      detalle: user?.username,
    },
  });
  await publishChange("users", ctx.projectId);

  return NextResponse.json({ ok: true });
}

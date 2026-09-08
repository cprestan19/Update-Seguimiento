import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Edita datos del usuario (nombre, usuario, rol, país, contraseña) y permite
// reactivarlo (active: true) — es la única forma de revertir una desactivación.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede editar personal" }, { status: 403 });
  }

  const body = await req.json();
  const { name, username, password, role, personnelRole, pais, active } = body as {
    name?: string;
    username?: string;
    password?: string;
    role?: "ADMIN" | "USER";
    personnelRole?: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
    pais?: string | null;
    active?: boolean;
  };

  if (session.user.id === params.id && active === false) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }

  const data: Record<string, unknown> = {};

  if (name !== undefined) {
    if (!name.trim()) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
    data.name = name.trim();
  }

  if (username !== undefined) {
    if (!username.trim()) return NextResponse.json({ error: "El usuario no puede estar vacío" }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
    if (existing && existing.id !== params.id) {
      return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
    }
    data.username = username.trim();
  }

  if (password) {
    if (password.length < 8) {
      return NextResponse.json({ error: "La contraseña debe tener al menos 8 caracteres" }, { status: 400 });
    }
    data.passwordHash = await bcrypt.hash(password, 10);
  }

  if (role !== undefined) data.role = role;
  if (personnelRole !== undefined) data.personnelRole = personnelRole || null;
  if (pais !== undefined) data.pais = pais || null;
  if (active !== undefined) data.active = active;

  const user = await prisma.user.update({
    where: { id: params.id },
    data,
    select: { id: true, name: true, username: true, role: true, personnelRole: true, pais: true, active: true },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "USUARIO_EDITADO", detalle: JSON.stringify({ id: user.id, username: user.username }) },
  });

  return NextResponse.json(user);
}

// Desactiva el usuario (no lo borra físicamente, para conservar el historial de auditoría)
// y lo desasigna de cualquier tienda donde estuviera participando.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede quitar personal" }, { status: 403 });
  }
  if (session.user.id === params.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }

  await prisma.store.updateMany({ where: { tecnicoId: params.id }, data: { tecnicoId: null } });
  await prisma.store.updateMany({ where: { auditorTIId: params.id }, data: { auditorTIId: null } });
  await prisma.store.updateMany({ where: { auditorInvId: params.id }, data: { auditorInvId: null } });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { active: false },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "USUARIO_DESACTIVADO", detalle: user.username },
  });

  return NextResponse.json({ ok: true });
}

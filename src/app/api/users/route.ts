import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";

// Cualquier usuario autenticado puede leer el listado (lo necesitan los
// selectores de tecnico/auditor al reasignar personal en una tienda).
// Crear, editar y desactivar usuarios sigue siendo exclusivo de ADMIN.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      username: true,
      role: true,
      personnelRole: true,
      pais: true,
      active: true,
      lastActiveAt: true,
      _count: {
        select: { storesAsTecnico: true, storesAsAuditorTI: true, storesAsAuditorInv: true },
      },
    },
  });

  const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos (heartbeat cada 60s)
  const now = Date.now();

  const data = users.map((u) => ({
    ...u,
    online: u.lastActiveAt ? now - u.lastActiveAt.getTime() < ONLINE_THRESHOLD_MS : false,
    tiendasAsignadas:
      u._count.storesAsTecnico + u._count.storesAsAuditorTI + u._count.storesAsAuditorInv,
    _count: undefined,
  }));

  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede crear usuarios" }, { status: 403 });
  }

  const body = await req.json();
  const { name, username, password, role, personnelRole, pais } = body as {
    name: string;
    username: string;
    password: string;
    role: "ADMIN" | "USER" | "MONITOR";
    personnelRole?: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
    pais?: string | null;
  };

  if (!name?.trim() || !username?.trim() || !password || password.length < 8) {
    return NextResponse.json(
      { error: "Nombre, usuario y contraseña (mínimo 8 caracteres) son obligatorios" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username: username.trim() } });
  if (existing) {
    return NextResponse.json({ error: "Ese nombre de usuario ya existe" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      username: username.trim(),
      passwordHash,
      role: role || "USER",
      personnelRole: personnelRole || null,
      pais: pais || null,
    },
    select: { id: true, name: true, username: true, role: true, personnelRole: true, pais: true },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "USUARIO_CREADO", detalle: `Creado: ${user.username}` },
  });
  await publishChange("users");

  return NextResponse.json(user);
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { publishChange } from "@/lib/realtime";
import { getProjectContext } from "@/lib/projectContext";

// Lista el equipo del proyecto activo (no todos los usuarios globales) —
// cualquier miembro autenticado puede leerlo, lo necesitan los selectores
// de tecnico/auditor/responsable.
export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const members = await prisma.projectMember.findMany({
    where: { projectId: ctx.projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          username: true,
          active: true,
          lastActiveAt: true,
          _count: {
            select: {
              storesAsTecnico: { where: { projectId: ctx.projectId } },
              storesAsAuditorTI: { where: { projectId: ctx.projectId } },
              storesAsAuditorInv: { where: { projectId: ctx.projectId } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const ONLINE_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutos (heartbeat cada 60s)
  const now = Date.now();

  const data = members.map((m) => ({
    id: m.user.id,
    name: m.user.name,
    username: m.user.username,
    role: m.role,
    personnelRole: m.personnelRole,
    pais: m.pais,
    active: m.user.active,
    online: m.user.lastActiveAt ? now - m.user.lastActiveAt.getTime() < ONLINE_THRESHOLD_MS : false,
    tiendasAsignadas:
      m.user._count.storesAsTecnico + m.user._count.storesAsAuditorTI + m.user._count.storesAsAuditorInv,
  }));

  return NextResponse.json(data);
}

// Crea una persona NUEVA (login nuevo) y la agrega al proyecto activo. Para
// agregar a alguien que ya existe en el sistema, usar /api/users/search +
// /api/users/attach en su lugar.
export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
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
    return NextResponse.json(
      { error: "Ese nombre de usuario ya existe. Si es una persona de otro proyecto, agrégala como 'Persona existente'." },
      { status: 409 }
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      username: username.trim(),
      passwordHash,
      lastActiveProjectId: ctx.projectId,
      projectMemberships: {
        create: {
          projectId: ctx.projectId,
          role: role || "USER",
          personnelRole: personnelRole || null,
          pais: pais || null,
        },
      },
    },
    select: { id: true, name: true, username: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "USUARIO_CREADO",
      detalle: `Creado: ${user.username}`,
    },
  });
  await publishChange("users", ctx.projectId);

  return NextResponse.json({ ...user, role: role || "USER", personnelRole: personnelRole || null, pais: pais || null });
}

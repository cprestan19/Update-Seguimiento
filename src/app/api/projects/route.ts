import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";
import { createProjectInDepartment, resolveProjectTemplate } from "@/lib/createProject";

// Crear un proyecto desde el proyecto activo: un ADMIN de ese proyecto (o un
// super admin) puede crear uno nuevo en el MISMO departamento sin ingresar la
// contraseña del departamento. Para crear en otro departamento sigue haciendo
// falta desbloquearlo — ver POST /api/departments/[id]/projects.
export async function POST(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN" && !ctx.isSuperAdmin) {
    return NextResponse.json({ error: "Solo un administrador puede crear proyectos" }, { status: 403 });
  }

  const body = (await req.json().catch(() => ({}))) as { name?: unknown; plantilla?: unknown };
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return NextResponse.json({ error: "El nombre del proyecto es obligatorio" }, { status: 400 });
  if (name.length > 120) return NextResponse.json({ error: "El nombre es demasiado largo" }, { status: 400 });

  const current = await prisma.project.findUnique({
    where: { id: ctx.projectId },
    select: { department: { select: { id: true, active: true } } },
  });
  if (!current?.department.active) {
    return NextResponse.json({ error: "El departamento de este proyecto no está activo" }, { status: 400 });
  }

  const template = await resolveProjectTemplate(body.plantilla, ctx);
  if (!template) return NextResponse.json({ error: "No puedes copiar la plantilla de ese proyecto" }, { status: 403 });

  return NextResponse.json(await createProjectInDepartment(current.department.id, ctx.userId, name, template));
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const memberships = await prisma.projectMember.findMany({
    where: { userId: session.user.id, project: { active: true } },
    include: { project: { select: { id: true, name: true, slug: true } } },
    orderBy: { createdAt: "asc" },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { lastActiveProjectId: true },
  });

  return NextResponse.json({
    projects: memberships.map((m) => ({
      id: m.project.id,
      name: m.project.name,
      slug: m.project.slug,
      role: m.role,
    })),
    lastActiveProjectId: user?.lastActiveProjectId || null,
  });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasDepartmentAccess } from "@/lib/departmentContext";
import { createProjectInDepartment } from "@/lib/createProject";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasDepartmentAccess(session, params.id)) {
    return NextResponse.json({ error: "Este departamento está bloqueado" }, { status: 403 });
  }

  const department = await prisma.department.findFirst({ where: { id: params.id, active: true } });
  if (!department) return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });

  const projects = await prisma.project.findMany({
    where: { departmentId: department.id, active: true },
    orderBy: { createdAt: "asc" },
    include: { members: { where: { userId: session.user.id }, select: { role: true } } },
  });

  return NextResponse.json({
    department: { id: department.id, name: department.name, slug: department.slug },
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      role: p.members[0]?.role ?? null,
    })),
  });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!hasDepartmentAccess(session, params.id)) {
    return NextResponse.json({ error: "Este departamento está bloqueado" }, { status: 403 });
  }

  const department = await prisma.department.findFirst({ where: { id: params.id, active: true } });
  if (!department) return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });

  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre del proyecto es obligatorio" }, { status: 400 });
  }

  return NextResponse.json(await createProjectInDepartment(department.id, session.user.id, name.trim()));
}

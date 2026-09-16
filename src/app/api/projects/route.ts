import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Crear proyectos nuevos ahora requiere pertenecer a un Departamento — ver
// POST /api/departments/[id]/projects.
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

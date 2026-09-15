import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultChecklistCatalog } from "@/lib/storeChecklist";

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "proyecto"
  );
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const esAdminEnAlgunProyecto = await prisma.projectMember.count({
    where: { userId: session.user.id, role: "ADMIN" },
  });
  if (esAdminEnAlgunProyecto === 0) {
    return NextResponse.json(
      { error: "Solo un administrador de algún proyecto puede crear proyectos nuevos" },
      { status: 403 }
    );
  }

  const { name } = (await req.json()) as { name: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre del proyecto es obligatorio" }, { status: 400 });
  }

  const base = slugify(name.trim());
  let slug = base;
  let n = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    n++;
    slug = `${base}-${n}`;
  }

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      slug,
      createdById: session.user.id,
      members: {
        create: { userId: session.user.id, role: "ADMIN" },
      },
    },
  });

  await ensureDefaultChecklistCatalog(project.id);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastActiveProjectId: project.id },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      projectId: project.id,
      accion: "PROYECTO_CREADO",
      detalle: project.name,
    },
  });

  return NextResponse.json({ id: project.id, name: project.name, slug: project.slug, role: "ADMIN" });
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Renombra un proyecto. Solo cambia el nombre visible: el slug queda fijo
// porque identifica al proyecto de forma estable (entre otras cosas, el slug
// "rpro-prism" es lo que hace que ese proyecto conserve "Pais" y el horario
// en texto libre — ver MIGRATION_PROJECT_SLUG en src/lib/projectContext.ts).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: params.id, userId: session.user.id } },
  });
  if (!member || member.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Solo un administrador de ese proyecto puede renombrarlo" },
      { status: 403 }
    );
  }

  const { name } = (await req.json()) as { name?: string };
  if (!name?.trim()) {
    return NextResponse.json({ error: "El nombre del proyecto es obligatorio" }, { status: 400 });
  }

  const project = await prisma.project.update({
    where: { id: params.id },
    data: { name: name.trim() },
    select: { id: true, name: true, slug: true },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      projectId: project.id,
      accion: "PROYECTO_RENOMBRADO",
      detalle: project.name,
    },
  });

  return NextResponse.json(project);
}

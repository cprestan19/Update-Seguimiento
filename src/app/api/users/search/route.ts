import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";

// Busca personas ya existentes (de cualquier proyecto) por nombre/usuario,
// para adjuntarlas al proyecto activo sin crear un login nuevo. Solo ADMIN
// del proyecto activo puede buscar, y se excluye a quienes ya son miembros.
export async function GET(req: Request) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede buscar personas" }, { status: 403 });
  }

  const q = new URL(req.url).searchParams.get("q")?.trim() || "";
  if (q.length < 2) return NextResponse.json([]);

  const yaMiembros = await prisma.projectMember.findMany({
    where: { projectId: ctx.projectId },
    select: { userId: true },
  });
  const excluidos = yaMiembros.map((m) => m.userId);

  const users = await prisma.user.findMany({
    where: {
      active: true,
      id: { notIn: excluidos },
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { username: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, username: true },
    take: 10,
  });

  return NextResponse.json(users);
}

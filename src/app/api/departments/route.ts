import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true } } },
  });

  return NextResponse.json({
    departments: departments.map((d) => ({
      id: d.id,
      name: d.name,
      slug: d.slug,
      projectCount: d._count.projects,
    })),
  });
}

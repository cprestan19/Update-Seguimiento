import { prisma } from "@/lib/prisma";

export type DepartmentSummary = {
  id: string;
  name: string;
  slug: string;
  projectCount: number;
  totalTiendas: number;
  completadas: number;
  pct: number;
};

export async function getDepartmentSummary(): Promise<DepartmentSummary[]> {
  const departments = await prisma.department.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      projects: {
        where: { active: true },
        select: { id: true, name: true, stores: { select: { estado: true } } },
      },
    },
  });

  return departments.map((d) => {
    const stores = d.projects.flatMap((p) => p.stores);
    const total = stores.length;
    const completadas = stores.filter((s) => s.estado === "COMPLETADA").length;
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
    return {
      id: d.id,
      name: d.name,
      slug: d.slug,
      projectCount: d.projects.length,
      totalTiendas: total,
      completadas,
      pct,
    };
  });
}

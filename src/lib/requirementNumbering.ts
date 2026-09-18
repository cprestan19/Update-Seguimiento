import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Numeracion atomica por proyecto+año, independiente del id interno de
// Prisma (ej. "REQ-2026-00001"). El upsert es una sola instruccion SQL
// (atomica en Postgres); solo puede haber una carrera real en la primera
// creacion del contador del año para un proyecto, que se resuelve
// reintentando una vez (para entonces el upsert de la otra request ya
// habra dejado la fila creada, y este reintento simplemente incrementa).
export async function getNextRequirementNumber(projectId: string): Promise<string> {
  const year = new Date().getFullYear();
  try {
    const counter = await prisma.requirementCounter.upsert({
      where: { projectId_year: { projectId, year } },
      create: { projectId, year, seq: 1 },
      update: { seq: { increment: 1 } },
    });
    return `REQ-${year}-${String(counter.seq).padStart(5, "0")}`;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return getNextRequirementNumber(projectId);
    }
    throw e;
  }
}

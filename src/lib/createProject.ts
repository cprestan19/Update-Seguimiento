import { prisma } from "@/lib/prisma";
import { ensureDefaultChecklistCatalog } from "@/lib/storeChecklist";
import { slugify } from "@/lib/slug";

// Crea un proyecto dentro de un departamento, con `userId` como su ADMIN, y
// lo deja como proyecto activo de ese usuario. La autorización (quién puede
// crear en qué departamento) la decide quien llama.
export async function createProjectInDepartment(departmentId: string, userId: string, name: string) {
  const base = slugify(name);
  let slug = base;
  let n = 1;
  while (await prisma.project.findUnique({ where: { slug } })) {
    n++;
    slug = `${base}-${n}`;
  }

  const project = await prisma.project.create({
    data: {
      name,
      slug,
      departmentId,
      createdById: userId,
      members: { create: { userId, role: "ADMIN" } },
    },
  });

  await ensureDefaultChecklistCatalog(project.id);

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveProjectId: project.id },
  });

  await prisma.auditLog.create({
    data: { userId, projectId: project.id, accion: "PROYECTO_CREADO", detalle: project.name },
  });

  return { id: project.id, name: project.name, slug: project.slug, role: "ADMIN" as const };
}

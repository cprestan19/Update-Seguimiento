import { prisma } from "@/lib/prisma";
import { copyChecklistTemplate, ensureDefaultChecklistCatalog } from "@/lib/storeChecklist";
import { slugify } from "@/lib/slug";

// Plantilla de checklist con la que nace el proyecto:
//   "default"         -> catálogo por defecto
//   "none"            -> sin criterios (se agregan después)
//   { from: id }      -> copia la plantilla de otro proyecto
export type ProjectTemplate = "default" | "none" | { from: string };

// Interpreta el campo `plantilla` que manda el cliente y verifica que el
// usuario pueda copiar del proyecto indicado (ADMIN de él, o super admin).
// Devuelve null si el proyecto de origen no está permitido.
export async function resolveProjectTemplate(
  raw: unknown,
  actor: { userId: string; isSuperAdmin: boolean }
): Promise<ProjectTemplate | null> {
  if (raw === undefined || raw === null || raw === "" || raw === "default") return "default";
  if (raw === "none") return "none";
  if (typeof raw !== "string") return null;
  const project = await prisma.project.findFirst({ where: { id: raw, active: true }, select: { id: true } });
  if (!project) return null;
  if (!actor.isSuperAdmin) {
    const m = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: raw, userId: actor.userId } },
      select: { role: true },
    });
    if (m?.role !== "ADMIN") return null;
  }
  return { from: raw };
}

// Crea un proyecto dentro de un departamento, con `userId` como su ADMIN, y
// lo deja como proyecto activo de ese usuario. La autorización (quién puede
// crear en qué departamento) la decide quien llama.
export async function createProjectInDepartment(
  departmentId: string,
  userId: string,
  name: string,
  template: ProjectTemplate = "default"
) {
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

  if (template === "default") await ensureDefaultChecklistCatalog(project.id);
  else if (template !== "none") await copyChecklistTemplate(template.from, project.id);

  await prisma.user.update({
    where: { id: userId },
    data: { lastActiveProjectId: project.id },
  });

  await prisma.auditLog.create({
    data: { userId, projectId: project.id, accion: "PROYECTO_CREADO", detalle: project.name },
  });

  return { id: project.id, name: project.name, slug: project.slug, role: "ADMIN" as const };
}

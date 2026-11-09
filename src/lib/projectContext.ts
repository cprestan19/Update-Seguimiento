import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { PersonnelRole, Role } from "@prisma/client";

export const ACTIVE_PROJECT_COOKIE = "active_project";

// El proyecto original de la migración RPro→Prism conserva su terminología
// ("País", horario en texto libre); todo proyecto nuevo usa la terminología
// actualizada ("Departamento", horario con selector AM/PM).
export const MIGRATION_PROJECT_SLUG = "rpro-prism";

export type ProjectContext = {
  userId: string;
  projectId: string;
  project: { id: string; name: string; slug: string };
  role: Role;
  personnelRole: PersonnelRole | null;
  pais: string | null;
  isMigrationProject: boolean;
  isSuperAdmin: boolean;
};

// Resuelve, en cada request, a qué proyecto pertenece la sesión actual y con
// qué rol — nunca se cachea en el JWT porque el rol es por proyecto y puede
// cambiar o revocarse en cualquier momento. Devuelve null si no hay sesión,
// no hay proyecto activo, o el usuario ya no es miembro de ese proyecto.
export async function getProjectContext(): Promise<ProjectContext | null> {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;
  if (!userId) return null;

  const projectId = (await cookies()).get(ACTIVE_PROJECT_COOKIE)?.value;
  if (!projectId) return null;

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    include: { project: { select: { id: true, name: true, slug: true, active: true } } },
  });
  if (!member || !member.project.active) return null;

  return {
    userId,
    projectId: member.projectId,
    project: member.project,
    role: member.role,
    personnelRole: member.personnelRole,
    pais: member.pais,
    isMigrationProject: member.project.slug === MIGRATION_PROJECT_SLUG,
    isSuperAdmin: Boolean((session.user as unknown as { isSuperAdmin?: boolean }).isSuperAdmin),
  };
}

// Verifica que un usuario dado sea miembro del proyecto (para validar
// asignaciones de tecnico/auditor/responsable antes de escribirlas).
export async function isProjectMember(projectId: string, userId: string): Promise<boolean> {
  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  return Boolean(member);
}

// Decide si `actor` puede modificar los datos GLOBALES de la cuenta de
// `targetUserId` (usuario, contraseña, activo/inactivo). Esos datos afectan a
// todos los proyectos y departamentos donde esa persona participa, así que un
// ADMIN de un proyecto solo puede tocarlos si administra TODOS los proyectos
// de esa persona. Nadie salvo un super admin puede tocar a un super admin.
export async function canManageGlobalAccount(
  actor: { userId: string; isSuperAdmin: boolean },
  targetUserId: string
): Promise<boolean> {
  if (actor.isSuperAdmin) return true;

  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { isSuperAdmin: true, projectMemberships: { select: { projectId: true } } },
  });
  if (!target || target.isSuperAdmin) return false;
  if (target.projectMemberships.length === 0) return false;

  const adminOf = await prisma.projectMember.count({
    where: {
      userId: actor.userId,
      role: "ADMIN",
      projectId: { in: target.projectMemberships.map((m) => m.projectId) },
    },
  });
  return adminOf === target.projectMemberships.length;
}

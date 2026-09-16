import type { Session } from "next-auth";

// Un Departamento se "desbloquea" en la sesión (JWT) al ingresar su contraseña
// de administrador compartida — ver /api/departments/[id]/unlock. Un super
// admin nunca necesita desbloquear nada: ve y administra todos.
export function hasDepartmentAccess(session: Session | null, departmentId: string): boolean {
  if (!session?.user) return false;
  const user = session.user as unknown as { isSuperAdmin?: boolean; deptAdminIds?: string[] };
  if (user.isSuperAdmin) return true;
  return Boolean(user.deptAdminIds?.includes(departmentId));
}

export function isSuperAdmin(session: Session | null): boolean {
  if (!session?.user) return false;
  return Boolean((session.user as unknown as { isSuperAdmin?: boolean }).isSuperAdmin);
}

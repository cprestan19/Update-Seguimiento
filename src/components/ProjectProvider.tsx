"use client";

import { createContext, useContext } from "react";

export type ProjectContextValue = {
  projectId: string;
  projectName: string;
  role: "ADMIN" | "USER" | "MONITOR";
  personnelRole: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
  isMigrationProject: boolean;
};

const ProjectCtx = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  value,
  children,
}: {
  value: ProjectContextValue;
  children: React.ReactNode;
}) {
  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

// Rol y proyecto activos del usuario — se resuelven en el servidor (nunca en
// el JWT) y se pasan una sola vez al layout del dashboard.
export function useProjectContext(): ProjectContextValue {
  const ctx = useContext(ProjectCtx);
  if (!ctx) throw new Error("useProjectContext debe usarse dentro de <ProjectProvider>");
  return ctx;
}

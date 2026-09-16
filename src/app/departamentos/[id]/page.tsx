"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" | null };

export default function DepartamentoPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session, status, update } = useSession();
  const router = useRouter();

  const [unlocking, setUnlocking] = useState(false);
  const [password, setPassword] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [departmentName, setDepartmentName] = useState<string | null>(null);
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [entering, setEntering] = useState(false);

  const user = session?.user as unknown as { isSuperAdmin?: boolean; deptAdminIds?: string[] } | undefined;
  const unlocked = Boolean(user?.isSuperAdmin || user?.deptAdminIds?.includes(id));

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  async function load() {
    const res = await fetch(`/api/departments/${id}/projects`);
    if (!res.ok) return;
    const data = await res.json();
    setDepartmentName(data.department?.name || null);
    setProjects(data.projects || []);
  }

  useEffect(() => {
    if (status === "authenticated" && unlocked) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, unlocked, id]);

  async function submitUnlock(e: React.FormEvent) {
    e.preventDefault();
    setUnlockError(null);
    setUnlocking(true);
    const res = await fetch(`/api/departments/${id}/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json();
      setUnlockError(data.error || "No se pudo desbloquear el departamento");
      setUnlocking(false);
      return;
    }
    await update({ deptAdminId: id });
    setUnlocking(false);
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!newName.trim()) {
      setCreateError("Ponle un nombre al proyecto");
      return;
    }
    setCreating(true);
    const res = await fetch(`/api/departments/${id}/projects`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json();
      setCreateError(data.error || "No se pudo crear el proyecto");
      return;
    }
    const project = await res.json();
    await enter(project.id);
  }

  async function enter(projectId: string) {
    setEntering(true);
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    window.location.href = "/dashboard";
  }

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">Cargando...</div>;
  }

  if (!unlocked) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm bg-panel border border-border rounded-2xl p-8">
          <h1 className="font-display text-base mb-1">Departamento bloqueado</h1>
          <p className="text-xs text-muted mb-5">
            Ingresa la contraseña de administrador de este departamento para ver su sección de proyectos.
          </p>
          <form onSubmit={submitUnlock} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña de administrador"
              autoComplete="current-password"
              required
              className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
            {unlockError && <p className="text-sm text-red">{unlockError}</p>}
            <button
              type="submit"
              disabled={unlocking}
              className="w-full bg-tealDim text-teal border border-teal/30 rounded-lg py-2.5 text-sm font-semibold hover:bg-teal/20 transition disabled:opacity-50"
            >
              {unlocking ? "Verificando..." : "Desbloquear"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  if (projects === null || entering) {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">Cargando...</div>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl p-8">
        <h1 className="font-display text-base mb-1">{departmentName || "Departamento"}</h1>
        <p className="text-xs text-muted mb-5">Proyectos de este departamento.</p>

        <div className="space-y-2 mb-6">
          {projects.length === 0 && <p className="text-sm text-muted">Todavía no hay proyectos.</p>}
          {projects.map((p) => (
            <div
              key={p.id}
              className="w-full bg-panel2 border border-border rounded-xl px-4 py-3 flex items-center justify-between gap-2"
            >
              <span className="text-sm font-medium truncate">{p.name}</span>
              {p.role ? (
                <button
                  onClick={() => enter(p.id)}
                  className="text-xs font-semibold text-teal hover:underline shrink-0"
                >
                  Entrar
                </button>
              ) : (
                <span className="text-[10px] uppercase tracking-wide text-muted2 shrink-0">Sin acceso</span>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={createProject} className="border-t border-border pt-4">
          <h2 className="text-xs font-semibold font-display mb-2.5">+ Nuevo proyecto</h2>
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Ej. Auditoría de inventario 2026"
              className="flex-1 bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear"}
            </button>
          </div>
          {createError && <p className="text-xs text-red mt-2">{createError}</p>}
        </form>
      </div>
    </main>
  );
}

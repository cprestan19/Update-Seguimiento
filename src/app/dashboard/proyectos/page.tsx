"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProjectContext } from "@/components/ProjectProvider";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" };

export default function ProyectosPage() {
  const { projectId: activeProjectId } = useProjectContext();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch("/api/projects");
    if (res.ok) {
      const data = await res.json();
      setProjects(data.projects || []);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function switchProject(projectId: string) {
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    window.location.href = "/dashboard";
  }

  function startRename(p: ProjectOption) {
    setRenamingId(p.id);
    setRenameValue(p.name);
    setRenameError(null);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    if (!renamingId) return;
    setRenameError(null);
    if (!renameValue.trim()) {
      setRenameError("El nombre no puede quedar vacío");
      return;
    }
    setSaving(true);
    const res = await fetch(`/api/projects/${renamingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: renameValue }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setRenameError(data.error || "No se pudo renombrar el proyecto");
      return;
    }
    // Recarga completa: el nombre tambien vive en la barra superior, que se
    // arma en el servidor.
    window.location.reload();
  }

  return (
    <div>
      <h1 className="font-display text-lg mb-1">Proyectos</h1>
      <p className="text-xs text-muted mb-6">
        Cada proyecto es un espacio aislado: su propio equipo, tiendas y seguimiento.
      </p>

      <div className="bg-panel border border-border rounded-2xl divide-y divide-border overflow-hidden mb-6">
        {projects.map((p) =>
          renamingId === p.id ? (
            <form key={p.id} onSubmit={submitRename} className="px-4 py-3 bg-panel2">
              <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">
                Nombre del proyecto
              </label>
              <div className="flex gap-2 flex-wrap">
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  className="flex-1 min-w-[220px] bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
                />
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
                >
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingId(null)}
                  className="text-muted hover:text-text text-xs px-3"
                >
                  Cancelar
                </button>
              </div>
              {renameError && <p className="text-xs text-red mt-2">{renameError}</p>}
            </form>
          ) : (
            <div key={p.id} className="flex items-center gap-3 px-4 py-3">
              <div className="flex-1">
                <div className="text-sm font-medium">{p.name}</div>
                <div className="text-[11px] text-muted">{p.role}</div>
              </div>
              {p.role === "ADMIN" && (
                <button
                  onClick={() => startRename(p)}
                  className="text-xs text-muted hover:text-blue"
                  title="Cambiar el nombre del proyecto"
                >
                  Renombrar
                </button>
              )}
              {p.id === activeProjectId ? (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-tealDim text-teal border border-teal/30">
                  Activo
                </span>
              ) : (
                <button
                  onClick={() => switchProject(p.id)}
                  className="text-xs text-muted hover:text-teal border border-border rounded-lg px-3 py-1.5 transition"
                >
                  Cambiar aquí
                </button>
              )}
            </div>
          )
        )}
      </div>

      <Link
        href="/departamentos"
        className="block text-center bg-tealDim text-teal border border-teal/30 rounded-2xl p-4 text-sm font-semibold hover:bg-teal/20 transition"
      >
        + Crear proyecto nuevo
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useProjectContext } from "@/components/ProjectProvider";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" };

export default function ProyectosPage() {
  const { projectId: activeProjectId } = useProjectContext();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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

  const puedeCrear = projects.some((p) => p.role === "ADMIN");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Ponle un nombre al proyecto");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setCreating(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo crear el proyecto");
      return;
    }
    const project = await res.json();
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    window.location.href = "/dashboard";
  }

  async function switchProject(projectId: string) {
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    window.location.href = "/dashboard";
  }

  return (
    <div>
      <h1 className="font-display text-lg mb-1">Proyectos</h1>
      <p className="text-xs text-muted mb-6">
        Cada proyecto es un espacio aislado: su propio equipo, tiendas y seguimiento.
      </p>

      <div className="bg-panel border border-border rounded-2xl divide-y divide-border overflow-hidden mb-6">
        {projects.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-3">
            <div className="flex-1">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-[11px] text-muted">{p.role}</div>
            </div>
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
        ))}
      </div>

      {puedeCrear && (
        <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-5">
          <h2 className="text-sm font-semibold font-display mb-3">+ Nuevo proyecto</h2>
          <div className="flex gap-2 flex-wrap">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Auditoría de inventario 2026"
              className="flex-1 min-w-[220px] bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <button
              type="submit"
              disabled={creating}
              className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
            >
              {creating ? "Creando..." : "Crear"}
            </button>
          </div>
          {error && <p className="text-xs text-red mt-2">{error}</p>}
        </form>
      )}
    </div>
  );
}

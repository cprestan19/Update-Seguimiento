"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProjectContext } from "@/components/ProjectProvider";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" };

export default function ProyectosPage() {
  const { projectId: activeProjectId } = useProjectContext();
  const [projects, setProjects] = useState<ProjectOption[]>([]);

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

      <Link
        href="/departamentos"
        className="block text-center bg-tealDim text-teal border border-teal/30 rounded-2xl p-4 text-sm font-semibold hover:bg-teal/20 transition"
      >
        + Crear proyecto nuevo
      </Link>
    </div>
  );
}

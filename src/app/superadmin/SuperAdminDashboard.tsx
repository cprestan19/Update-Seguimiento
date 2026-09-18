"use client";

import { useEffect, useState } from "react";
import type { DepartmentSummary } from "@/lib/superadminSummary";

// El panel global no tiene un proyecto activo (un super admin puede no ser
// miembro de ninguno), así que no puede usar el canal SSE de /api/events
// (ese exige getProjectContext()). Se actualiza con polling simple cada
// 30s, el mismo intervalo que ya usa Equipo para refrescar en segundo plano.
const POLL_MS = 30_000;

export default function SuperAdminDashboard({ initialDepartments }: { initialDepartments: DepartmentSummary[] }) {
  const [departments, setDepartments] = useState(initialDepartments);

  useEffect(() => {
    async function refresh() {
      const res = await fetch("/api/superadmin/summary");
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    }
    const interval = setInterval(refresh, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  const totalProyectos = departments.reduce((sum, d) => sum + d.projectCount, 0);
  const totalTiendas = departments.reduce((sum, d) => sum + d.totalTiendas, 0);
  const totalCompletadas = departments.reduce((sum, d) => sum + d.completadas, 0);
  const avanceGlobal = totalTiendas > 0 ? Math.round((totalCompletadas / totalTiendas) * 100) : 0;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Kpi label="Departamentos" value={departments.length} />
        <Kpi label="Proyectos" value={totalProyectos} />
        <Kpi label="Tiendas" value={totalTiendas} />
        <Kpi label="Avance global" value={`${avanceGlobal}%`} color="text-teal" />
      </div>

      <div className="bg-panel border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {departments.length === 0 && (
          <p className="text-sm text-muted text-center py-8">Todavía no hay departamentos creados.</p>
        )}
        {departments.map((d) => (
          <div key={d.id} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{d.name}</div>
              <div className="text-[11px] text-muted">
                {d.projectCount} proyecto{d.projectCount === 1 ? "" : "s"} · {d.totalTiendas} tiendas
              </div>
              <div className="h-1.5 rounded bg-panel2 overflow-hidden mt-1.5 max-w-[220px]">
                <div className="h-full rounded bg-teal" style={{ width: `${d.pct}%` }} />
              </div>
            </div>
            <span className="font-mono text-sm font-semibold text-teal shrink-0">{d.pct}%</span>
          </div>
        ))}
      </div>
    </>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-panel border border-border rounded-xl px-3.5 py-3.5">
      <div className={`font-display text-[26px] leading-none font-semibold ${color || ""}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted mt-1.5">{label}</div>
    </div>
  );
}

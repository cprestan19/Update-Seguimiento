"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type StoreRow = {
  id: string;
  pais: string;
  region: string;
  tienda: string;
  horario: string;
  minutosDia: number;
  estado: "PENDIENTE" | "EN_PROGRESO" | "COMPLETADA" | "CON_INCIDENCIA";
  tecnico: { id: string; name: string } | null;
  auditorTI: { id: string; name: string } | null;
  auditorInv: { id: string; name: string } | null;
  tiempoEstimadoMin: number;
  duracionRealMin: number | null;
  progreso: number;
  incidenciasAbiertas: number;
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADA: "Completada",
  CON_INCIDENCIA: "Con incidencia",
};
const ESTADO_COLOR: Record<string, string> = {
  PENDIENTE: "#4E5A6B",
  EN_PROGRESO: "#3B9EFF",
  COMPLETADA: "#2DD4BF",
  CON_INCIDENCIA: "#F2495C",
};
const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: "bg-panel2 text-muted border border-border",
  EN_PROGRESO: "bg-blueDim text-blue",
  COMPLETADA: "bg-tealDim text-teal",
  CON_INCIDENCIA: "bg-redDim text-red",
};

export default function DashboardPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pais, setPais] = useState("");
  const [estado, setEstado] = useState("");

  async function load() {
    setLoading(true);
    const res = await fetch("/api/stores");
    if (res.ok) setStores(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const paises = useMemo(() => [...new Set(stores.map((s) => s.pais))].sort(), [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (q && !s.tienda.toLowerCase().includes(q.toLowerCase()) && !s.region.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (pais && s.pais !== pais) return false;
      if (estado && s.estado !== estado) return false;
      return true;
    });
  }, [stores, q, pais, estado]);

  const kpis = useMemo(() => {
    const total = stores.length;
    const completadas = stores.filter((s) => s.estado === "COMPLETADA").length;
    const progreso = stores.filter((s) => s.estado === "EN_PROGRESO").length;
    const pendientes = stores.filter((s) => s.estado === "PENDIENTE").length;
    const incidencias = stores.filter((s) => s.estado === "CON_INCIDENCIA").length;
    const completadasConTiempo = stores.filter((s) => s.duracionRealMin != null);
    const tiempoProm = completadasConTiempo.length
      ? Math.round(
          completadasConTiempo.reduce((a, s) => a + (s.duracionRealMin || 0), 0) /
            completadasConTiempo.length
        )
      : null;
    return { total, completadas, progreso, pendientes, incidencias, tiempoProm };
  }, [stores]);

  if (loading) {
    return <div className="text-muted text-sm py-10 text-center">Cargando tiendas...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3.5 mb-6">
        <Kpi label="Total tiendas" value={kpis.total} />
        <Kpi label="Completadas" value={kpis.completadas} color="text-teal" />
        <Kpi label="En progreso" value={kpis.progreso} color="text-blue" />
        <Kpi label="Pendientes" value={kpis.pendientes} color="text-amber" />
        <Kpi label="Con incidencia" value={kpis.incidencias} color="text-red" />
        <Kpi
          label="Tiempo prom. real"
          value={kpis.tiempoProm != null ? `${kpis.tiempoProm}m` : "—"}
          color="text-text"
        />
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tienda o región..."
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue"
        />
        <select
          value={pais}
          onChange={(e) => setPais(e.target.value)}
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
        >
          <option value="">Todos los países</option>
          {paises.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <select
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted ml-auto">
          {filtered.length} de {stores.length} tiendas
        </span>
      </div>

      <div className="bg-panel border border-border rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel2 text-[11px] uppercase tracking-wide text-muted">
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-left px-4 py-3 font-semibold">País</th>
              <th className="text-left px-4 py-3 font-semibold">Tienda</th>
              <th className="text-left px-4 py-3 font-semibold">Horario</th>
              <th className="text-left px-4 py-3 font-semibold">Técnico</th>
              <th className="text-left px-4 py-3 font-semibold">Progreso</th>
            </tr>
          </thead>
          <tbody>
            {filtered
              .slice()
              .sort((a, b) => a.minutosDia - b.minutosDia)
              .map((s) => (
                <tr key={s.id} className="border-b border-border last:border-none hover:bg-[#151C27]">
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[s.estado]}`}>
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: ESTADO_COLOR[s.estado] }}
                      />
                      {ESTADO_LABEL[s.estado]}
                      {s.incidenciasAbiertas > 0 ? ` (${s.incidenciasAbiertas})` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2.5">{s.pais}</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/tiendas/${s.id}`} className="font-medium hover:text-teal">
                      {s.tienda}
                    </Link>
                    <div className="text-[12px] text-muted">{s.region}</div>
                  </td>
                  <td className="px-4 py-2.5 font-mono text-muted text-xs">{s.horario}</td>
                  <td className="px-4 py-2.5">
                    {s.tecnico ? s.tecnico.name : <span className="text-muted2 italic text-xs">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="w-24 h-1.5 rounded bg-panel2 overflow-hidden">
                      <div
                        className="h-full rounded"
                        style={{ width: `${s.progreso}%`, background: ESTADO_COLOR[s.estado] }}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Kpi({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="bg-panel border border-border rounded-xl px-4 py-3.5">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-display text-2xl font-semibold mt-1.5 ${color || ""}`}>{value}</div>
    </div>
  );
}

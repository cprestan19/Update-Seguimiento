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

type GroupRow = {
  key: string;
  total: number;
  completadas: number;
  faltantes: number;
  efectividad: number;
  tiempoPromedio: number | null;
  etaMinutosDia: number | null;
};

function buildGroups(stores: StoreRow[], groupBy: "pais" | "region"): GroupRow[] {
  const map = new Map<string, StoreRow[]>();
  for (const s of stores) {
    const key = groupBy === "pais" ? s.pais : s.region;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }

  const completadasConTiempoGlobal = stores.filter((s) => s.duracionRealMin != null);
  const promedioGlobal = completadasConTiempoGlobal.length
    ? completadasConTiempoGlobal.reduce((a, s) => a + (s.duracionRealMin || 0), 0) /
      completadasConTiempoGlobal.length
    : null;

  return Array.from(map.entries())
    .map(([key, list]) => {
      const total = list.length;
      const completadas = list.filter((s) => s.estado === "COMPLETADA").length;
      const faltantes = total - completadas;
      const efectividad = total > 0 ? Math.round((completadas / total) * 100) : 0;

      const completadasConTiempo = list.filter((s) => s.duracionRealMin != null);
      const tiempoPromedio = completadasConTiempo.length
        ? Math.round(
            completadasConTiempo.reduce((a, s) => a + (s.duracionRealMin || 0), 0) /
              completadasConTiempo.length
          )
        : null;

      const pendientes = list.filter((s) => s.estado !== "COMPLETADA");
      const etaMinutosDia = pendientes.length
        ? Math.max(...pendientes.map((s) => s.minutosDia + (promedioGlobal ?? s.tiempoEstimadoMin)))
        : null;

      return { key, total, completadas, faltantes, efectividad, tiempoPromedio, etaMinutosDia };
    })
    .sort((a, b) => b.total - a.total);
}

function formatMinutosDia(min: number): string {
  const wrapped = ((Math.round(min) % 1440) + 1440) % 1440;
  const hh24 = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  const period = hh24 < 12 ? "AM" : "PM";
  let hh12 = hh24 % 12;
  if (hh12 === 0) hh12 = 12;
  return `${hh12}:${String(mm).padStart(2, "0")}${period}`;
}

export default function DashboardPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pais, setPais] = useState("");
  const [estado, setEstado] = useState("");
  const [groupBy, setGroupBy] = useState<"pais" | "region">("pais");

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

  const groups = useMemo(() => buildGroups(stores, groupBy), [stores, groupBy]);

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

      <div className="bg-panel border border-border rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3.5 flex-wrap gap-2">
          <h2 className="text-sm font-semibold font-display">Resumen por {groupBy === "pais" ? "país" : "región"}</h2>
          <div className="flex gap-1 bg-panel2 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setGroupBy("pais")}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                groupBy === "pais" ? "bg-tealDim text-teal" : "text-muted hover:text-text"
              }`}
            >
              País
            </button>
            <button
              onClick={() => setGroupBy("region")}
              className={`text-xs px-2.5 py-1 rounded-md transition ${
                groupBy === "region" ? "bg-tealDim text-teal" : "text-muted hover:text-text"
              }`}
            >
              Región
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wide text-muted">
                <th className="text-left py-2 pr-3 font-semibold">{groupBy === "pais" ? "País" : "Región"}</th>
                <th className="text-left py-2 px-3 font-semibold">Completadas</th>
                <th className="text-left py-2 px-3 font-semibold">Faltantes</th>
                <th className="text-left py-2 px-3 font-semibold">% Efectividad</th>
                <th className="text-left py-2 px-3 font-semibold">Tiempo prom.</th>
                <th className="text-left py-2 pl-3 font-semibold">Hora est. término</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => (
                <tr key={g.key} className="border-t border-border">
                  <td className="py-2.5 pr-3 font-medium">{g.key}</td>
                  <td className="py-2.5 px-3 text-teal">
                    {g.completadas}/{g.total}
                  </td>
                  <td className="py-2.5 px-3">
                    {g.faltantes > 0 ? (
                      <span className="text-amber">{g.faltantes}</span>
                    ) : (
                      <span className="text-muted2">0</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded bg-panel2 overflow-hidden">
                        <div
                          className="h-full rounded bg-teal"
                          style={{ width: `${g.efectividad}%` }}
                        />
                      </div>
                      <span className="font-mono text-xs text-muted">{g.efectividad}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-xs text-muted">
                    {g.tiempoPromedio != null ? `${g.tiempoPromedio}m` : "—"}
                  </td>
                  <td className="py-2.5 pl-3 font-mono text-xs">
                    {g.etaMinutosDia != null ? (
                      formatMinutosDia(g.etaMinutosDia)
                    ) : (
                      <span className="text-teal">Completado</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

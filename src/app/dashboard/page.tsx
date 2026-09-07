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

function buildPaisAvance(stores: StoreRow[]) {
  const map = new Map<string, StoreRow[]>();
  for (const s of stores) {
    if (!map.has(s.pais)) map.set(s.pais, []);
    map.get(s.pais)!.push(s);
  }
  return Array.from(map.entries())
    .map(([pais, list]) => {
      const total = list.length;
      const completadas = list.filter((s) => s.estado === "COMPLETADA").length;
      const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
      return { pais, total, completadas, pct };
    })
    .sort((a, b) => b.pct - a.pct);
}

type AtencionReason = "incidencia" | "atrasada" | "sin_tecnico";
type AtencionItem = { store: StoreRow; reason: AtencionReason };

const ATENCION_PRIORITY: Record<AtencionReason, number> = {
  incidencia: 0,
  atrasada: 1,
  sin_tecnico: 2,
};

function buildAtencion(stores: StoreRow[], nowMinutes: number): AtencionItem[] {
  const items: AtencionItem[] = [];
  for (const s of stores) {
    if (s.estado === "COMPLETADA") continue;
    if (s.estado === "CON_INCIDENCIA" || s.incidenciasAbiertas > 0) {
      items.push({ store: s, reason: "incidencia" });
    } else if (s.minutosDia < nowMinutes) {
      items.push({ store: s, reason: "atrasada" });
    } else if (!s.tecnico) {
      items.push({ store: s, reason: "sin_tecnico" });
    }
  }
  return items.sort(
    (a, b) => ATENCION_PRIORITY[a.reason] - ATENCION_PRIORITY[b.reason] || a.store.minutosDia - b.store.minutosDia
  );
}

export default function DashboardPage() {
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [pais, setPais] = useState("");
  const [region, setRegion] = useState("");
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
  const regiones = useMemo(() => [...new Set(stores.map((s) => s.region))].sort(), [stores]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      if (q && !s.tienda.toLowerCase().includes(q.toLowerCase()) && !s.region.toLowerCase().includes(q.toLowerCase()))
        return false;
      if (pais && s.pais !== pais) return false;
      if (region && s.region !== region) return false;
      if (estado && s.estado !== estado) return false;
      return true;
    });
  }, [stores, q, pais, region, estado]);

  const sortedFiltered = useMemo(
    () => [...filtered].sort((a, b) => a.minutosDia - b.minutosDia),
    [filtered]
  );

  const kpis = useMemo(() => {
    const total = stores.length;
    const completadas = stores.filter((s) => s.estado === "COMPLETADA").length;
    const progreso = stores.filter((s) => s.estado === "EN_PROGRESO").length;
    const pendientes = stores.filter((s) => s.estado === "PENDIENTE").length;
    const incidencias = stores.filter((s) => s.estado === "CON_INCIDENCIA").length;
    const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;
    return { total, completadas, progreso, pendientes, incidencias, avance };
  }, [stores]);

  const estadoCounts = useMemo(
    () => [
      { key: "COMPLETADA", label: "Completada", count: kpis.completadas, color: ESTADO_COLOR.COMPLETADA },
      { key: "EN_PROGRESO", label: "En progreso", count: kpis.progreso, color: ESTADO_COLOR.EN_PROGRESO },
      { key: "PENDIENTE", label: "Pendiente", count: kpis.pendientes, color: ESTADO_COLOR.PENDIENTE },
      { key: "CON_INCIDENCIA", label: "Con incidencia", count: kpis.incidencias, color: ESTADO_COLOR.CON_INCIDENCIA },
    ],
    [kpis]
  );

  const paisAvance = useMemo(() => buildPaisAvance(stores), [stores]);

  const atencion = useMemo(() => {
    const now = new Date();
    return buildAtencion(stores, now.getHours() * 60 + now.getMinutes());
  }, [stores]);

  if (loading) {
    return <div className="text-muted text-sm py-10 text-center">Cargando tiendas...</div>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
        <Kpi label="Tiendas" value={kpis.total} />
        <Kpi label="Completadas" value={kpis.completadas} color="text-teal" />
        <Kpi label="En progreso" value={kpis.progreso} color="text-blue" />
        <Kpi label="Pendientes" value={kpis.pendientes} color="text-muted" />
        <Kpi label="Con incidencia" value={kpis.incidencias} color="text-red" />
        <Kpi label="Avance" value={`${kpis.avance}%`} color="text-teal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        <EstadoChart counts={estadoCounts} />
        <PaisAvanceChart rows={paisAvance} />
      </div>

      <AtencionSection items={atencion} />

      <div className="flex flex-wrap gap-2.5 mb-4 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar tienda o región..."
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] flex-1 sm:flex-none focus:outline-none focus:ring-2 focus:ring-blue"
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
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
        >
          <option value="">Todas las regiones</option>
          {regiones.map((r) => (
            <option key={r} value={r}>
              {r}
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
        <span className="text-xs text-muted w-full sm:w-auto sm:ml-auto">
          {filtered.length} de {stores.length} tiendas
        </span>
      </div>

      {/* Tabla — desktop / tablet */}
      <div className="hidden md:block bg-panel border border-border rounded-2xl overflow-hidden overflow-x-auto">
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
            {sortedFiltered.map((s) => (
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
            {sortedFiltered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">
                  No hay tiendas que coincidan con los filtros.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — mobile */}
      <div className="md:hidden space-y-2.5">
        {sortedFiltered.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/tiendas/${s.id}`}
            className="block bg-panel border border-border rounded-xl p-3.5 active:bg-[#151C27]"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[s.estado]}`}>
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: ESTADO_COLOR[s.estado] }} />
                {ESTADO_LABEL[s.estado]}
                {s.incidenciasAbiertas > 0 ? ` (${s.incidenciasAbiertas})` : ""}
              </span>
              <span className="font-mono text-xs text-muted shrink-0">{s.horario}</span>
            </div>
            <div className="font-medium text-sm">{s.tienda}</div>
            <div className="text-xs text-muted mb-2.5">
              {s.pais} · {s.region}
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex-1 h-1.5 rounded bg-panel2 overflow-hidden">
                <div
                  className="h-full rounded"
                  style={{ width: `${s.progreso}%`, background: ESTADO_COLOR[s.estado] }}
                />
              </div>
              <span className="text-xs text-muted shrink-0">
                {s.tecnico ? s.tecnico.name : "Sin técnico"}
              </span>
            </div>
          </Link>
        ))}
        {sortedFiltered.length === 0 && (
          <p className="text-sm text-muted text-center py-8">No hay tiendas que coincidan con los filtros.</p>
        )}
      </div>
    </div>
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

function EstadoChart({
  counts,
}: {
  counts: { key: string; label: string; count: number; color: string }[];
}) {
  const max = Math.max(1, ...counts.map((c) => c.count));
  return (
    <div className="bg-panel border border-border rounded-2xl p-4">
      <h2 className="text-sm font-semibold font-display mb-4">Estado de las tiendas</h2>
      <div className="space-y-3">
        {counts.map((c) => (
          <div key={c.key} className="flex items-center gap-3">
            <span className="w-[92px] shrink-0 text-xs text-muted">{c.label}</span>
            <div className="flex-1 h-2.5 rounded-full bg-panel2 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${(c.count / max) * 100}%`, background: c.color }}
              />
            </div>
            <span className="w-7 shrink-0 text-right text-xs font-mono text-text">{c.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PaisAvanceChart({
  rows,
}: {
  rows: { pais: string; total: number; completadas: number; pct: number }[];
}) {
  return (
    <div className="bg-panel border border-border rounded-2xl p-4">
      <h2 className="text-sm font-semibold font-display mb-4">Avance por país</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <div key={r.pais} className="flex items-center gap-3">
            <span className="w-[100px] shrink-0 text-xs text-muted truncate" title={r.pais}>
              {r.pais}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-panel2 overflow-hidden">
              <div className="h-full rounded-full bg-teal" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-mono text-text">{r.pct}%</span>
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted">Sin datos.</p>}
      </div>
    </div>
  );
}

const ATENCION_LABEL: Record<AtencionReason, string> = {
  incidencia: "Incidencia",
  atrasada: "Atrasada",
  sin_tecnico: "Sin técnico",
};
const ATENCION_COLOR: Record<AtencionReason, string> = {
  incidencia: "bg-redDim text-red",
  atrasada: "bg-amberDim text-amber",
  sin_tecnico: "bg-panel2 text-muted border border-border",
};

function AtencionSection({ items }: { items: AtencionItem[] }) {
  const shown = items.slice(0, 6);
  return (
    <div className="bg-panel border border-border rounded-2xl p-4 mb-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold font-display">Requiere atención</h2>
        {items.length > 0 && (
          <span className="text-[11px] text-muted">
            {items.length} caso{items.length === 1 ? "" : "s"}
          </span>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-teal">Todo en orden — sin alertas pendientes.</p>
      ) : (
        <div className="space-y-1">
          {shown.map(({ store, reason }) => (
            <Link
              key={store.id}
              href={`/dashboard/tiendas/${store.id}`}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#151C27] active:bg-[#151C27] transition"
            >
              <span
                className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full font-semibold ${ATENCION_COLOR[reason]}`}
              >
                {ATENCION_LABEL[reason]}
              </span>
              <span className="text-sm font-medium truncate">{store.tienda}</span>
              <span className="text-xs text-muted truncate hidden sm:inline">{store.pais}</span>
              <span className="ml-auto text-muted text-xs shrink-0">→</span>
            </Link>
          ))}
          {items.length > shown.length && (
            <p className="text-[11px] text-muted2 pt-1.5 px-2.5">
              +{items.length - shown.length} más con atención pendiente
            </p>
          )}
        </div>
      )}
    </div>
  );
}

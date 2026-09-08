"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  useReducedMotion,
  animate,
} from "framer-motion";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";

type StoreRow = {
  id: string;
  pais: string;
  region: string;
  tienda: string;
  horario: string;
  inicioReal: string | null;
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

function formatHoraCorta(iso: string): string {
  const d = new Date(iso);
  let hh = d.getHours();
  const mm = d.getMinutes();
  const period = hh < 12 ? "AM" : "PM";
  hh = hh % 12;
  if (hh === 0) hh = 12;
  return `${hh}:${String(mm).padStart(2, "0")}${period}`;
}

// Muestra la hora real que asignó el técnico (Hora de inicio) cuando ya
// existe; si aún no ha iniciado, cae de vuelta al horario programado.
function horaMostrada(s: Pick<StoreRow, "horario" | "inicioReal">): string {
  return s.inicioReal ? formatHoraCorta(s.inicioReal) : s.horario;
}

// Minutos del día para ordenar, coherente con lo que muestra horaMostrada().
function horaMinutosOrden(s: Pick<StoreRow, "minutosDia" | "inicioReal">): number {
  if (!s.inicioReal) return s.minutosDia;
  const d = new Date(s.inicioReal);
  return d.getHours() * 60 + d.getMinutes();
}

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
  const [estado, setEstado] = useState("EN_PROGRESO");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);

  function filterByEstado(value: string) {
    setEstado(value);
    setQ("");
    setPais("");
    setRegion("");
    requestAnimationFrame(() => {
      tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function load() {
    setLoading(true);
    const res = await fetch("/api/stores");
    if (res.ok) setStores(await res.json());
    setLoading(false);
  }

  async function refetchQuiet() {
    const res = await fetch("/api/stores");
    if (res.ok) setStores(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh("stores", refetchQuiet);

  const paises = useMemo(() => [...new Set(stores.map((s) => s.pais))].sort(), [stores]);
  const regiones = useMemo(() => [...new Set(stores.map((s) => s.region))].sort(), [stores]);
  const filtrosActivos = [pais, region, estado].filter(Boolean).length;

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

  type SortKey = "estado" | "pais" | "tienda" | "horario" | "tecnico" | "progreso";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedFiltered = useMemo(() => {
    const arr = [...filtered];
    if (!sortKey) {
      arr.sort((a, b) => horaMinutosOrden(a) - horaMinutosOrden(b));
      return arr;
    }
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortKey) {
        case "estado":
          return ESTADO_LABEL[a.estado].localeCompare(ESTADO_LABEL[b.estado]) * dir;
        case "pais":
          return a.pais.localeCompare(b.pais) * dir;
        case "tienda":
          return a.tienda.localeCompare(b.tienda) * dir;
        case "horario":
          return (horaMinutosOrden(a) - horaMinutosOrden(b)) * dir;
        case "tecnico":
          return (a.tecnico?.name || "").localeCompare(b.tecnico?.name || "") * dir;
        case "progreso":
          return (a.progreso - b.progreso) * dir;
        default:
          return 0;
      }
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const kpis = useMemo(() => {
    const total = stores.length;
    const completadas = stores.filter((s) => s.estado === "COMPLETADA").length;
    const progreso = stores.filter((s) => s.estado === "EN_PROGRESO").length;
    const pendientes = stores.filter((s) => s.estado === "PENDIENTE").length;
    const incidencias = stores.filter((s) => s.estado === "CON_INCIDENCIA").length;
    const avance = total > 0 ? Math.round((completadas / total) * 100) : 0;
    return { total, completadas, progreso, pendientes, incidencias, avance };
  }, [stores]);

  // Avance de migración: usa exactamente el mismo conjunto filtrado que el
  // resto del dashboard — sin lógica de cálculo independiente.
  const avanceFiltrado = useMemo(() => {
    const total = filtered.length;
    const completadas = filtered.filter((s) => s.estado === "COMPLETADA").length;
    const progreso = filtered.filter((s) => s.estado === "EN_PROGRESO").length;
    const pendientes = filtered.filter((s) => s.estado === "PENDIENTE").length;
    const incidencias = filtered.filter((s) => s.estado === "CON_INCIDENCIA").length;
    const pct = total > 0 ? Math.round((completadas / total) * 100) : 0;
    return { total, completadas, progreso, pendientes, incidencias, pct };
  }, [filtered]);

  const paisAvance = useMemo(() => buildPaisAvance(stores), [stores]);

  const atencion = useMemo(() => {
    const now = new Date();
    return buildAtencion(stores, now.getHours() * 60 + now.getMinutes());
  }, [stores]);

  if (loading) {
    return <div className="text-muted text-sm py-10 text-center">Cargando tiendas...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-5"
    >
      <div className="order-2 lg:order-1 lg:col-span-2 grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Tiendas" value={kpis.total} active={estado === ""} onClick={() => filterByEstado("")} />
        <Kpi
          label="Completadas"
          value={kpis.completadas}
          color="text-teal"
          active={estado === "COMPLETADA"}
          onClick={() => filterByEstado("COMPLETADA")}
        />
        <Kpi
          label="En progreso"
          value={kpis.progreso}
          color="text-blue"
          active={estado === "EN_PROGRESO"}
          onClick={() => filterByEstado("EN_PROGRESO")}
        />
        <Kpi
          label="Pendientes"
          value={kpis.pendientes}
          color="text-muted"
          active={estado === "PENDIENTE"}
          onClick={() => filterByEstado("PENDIENTE")}
        />
        <Kpi
          label="Con incidencia"
          value={kpis.incidencias}
          color="text-red"
          active={estado === "CON_INCIDENCIA"}
          onClick={() => filterByEstado("CON_INCIDENCIA")}
        />
        <Kpi label="Avance" value={`${kpis.avance}%`} color="text-teal" />
      </div>

      <div className="order-1 lg:order-2">
        <AvanceMigracionCard data={avanceFiltrado} selected={estado} onSelect={filterByEstado} />
      </div>

      <div className="order-4 lg:order-2">
        <PaisAvanceChart
          rows={paisAvance}
          onSelect={(p) => {
            setEstado("");
            setQ("");
            setRegion("");
            setPais(p);
            requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
          }}
        />
      </div>

      <div className="order-3 lg:order-3 lg:col-span-2">
        <AtencionSection items={atencion} />
      </div>

      <div ref={tableRef} className="order-5 lg:order-4 lg:col-span-2">
        {/* Búsqueda + filtros — mobile: barra + botón que abre hoja inferior */}
        <div className="md:hidden flex gap-2 mb-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar tienda..."
            className="flex-1 bg-panel border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue"
          />
          <button
            onClick={() => setFiltersOpen(true)}
            className="relative bg-panel border border-border rounded-lg px-4 py-2.5 text-sm font-semibold text-text shrink-0 active:bg-panel2"
          >
            Filtros
            {filtrosActivos > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-teal text-[10px] font-bold text-[#04110F] flex items-center justify-center">
                {filtrosActivos}
              </span>
            )}
          </button>
        </div>

        {/* Filtros — desktop / tablet, siempre visibles */}
        <div className="hidden md:flex flex-wrap gap-2.5 mb-4 items-center">
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
          <span className="text-xs text-muted ml-auto">
            {filtered.length} de {stores.length} tiendas
          </span>
          <a
            href="/api/reports/excel"
            className="bg-panel border border-border rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:text-teal hover:border-teal/40 transition"
          >
            Excel
          </a>
          <a
            href="/api/reports/pdf"
            className="bg-panel border border-border rounded-lg px-3 py-2 text-xs font-semibold text-muted hover:text-red hover:border-red/40 transition"
          >
            PDF
          </a>
        </div>

        <div className="md:hidden flex items-center justify-between mb-4">
          <span className="text-xs text-muted">
            {filtered.length} de {stores.length} tiendas
          </span>
          <div className="flex gap-2">
            <a href="/api/reports/excel" className="text-xs font-semibold text-muted active:text-teal">
              Excel
            </a>
            <a href="/api/reports/pdf" className="text-xs font-semibold text-muted active:text-red">
              PDF
            </a>
          </div>
        </div>

        {/* Tabla — desktop / tablet */}
        <div className="hidden md:block bg-panel border border-border rounded-2xl overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-panel2 text-[11px] uppercase tracking-wide text-muted">
                <SortTh label="Estado" sortKey="estado" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="País" sortKey="pais" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Tienda" sortKey="tienda" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Horario" sortKey="horario" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Técnico" sortKey="tecnico" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
                <SortTh label="Progreso" sortKey="progreso" activeKey={sortKey} dir={sortDir} onSort={handleSort} />
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
                  <td className="px-4 py-2.5 font-mono text-muted text-xs">{horaMostrada(s)}</td>
                  <td className="px-4 py-2.5">
                    {s.tecnico ? s.tecnico.name : <span className="text-muted2 italic text-xs">Sin asignar</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-1.5 rounded bg-panel2 overflow-hidden">
                        <div
                          className="h-full rounded"
                          style={{ width: `${s.progreso}%`, background: ESTADO_COLOR[s.estado] }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-muted w-8 shrink-0">{s.progreso}%</span>
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
              className="block bg-panel border border-border rounded-xl p-3.5 active:bg-[#151C27] active:scale-[0.99] transition"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[s.estado]}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: ESTADO_COLOR[s.estado] }} />
                  {ESTADO_LABEL[s.estado]}
                  {s.incidenciasAbiertas > 0 ? ` (${s.incidenciasAbiertas})` : ""}
                </span>
                <span className="font-mono text-xs text-muted shrink-0">{horaMostrada(s)}</span>
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
                <span className="text-[11px] font-mono text-muted shrink-0">{s.progreso}%</span>
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

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        pais={pais}
        setPais={setPais}
        region={region}
        setRegion={setRegion}
        estado={estado}
        setEstado={setEstado}
        paises={paises}
        regiones={regiones}
      />
    </motion.div>
  );
}

function SortTh({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: "asc" | "desc";
  onSort: (key: any) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="text-left px-4 py-3 font-semibold">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`flex items-center gap-1 hover:text-text transition ${active ? "text-text" : ""}`}
      >
        {label}
        <span className={`text-[10px] ${active ? "opacity-100" : "opacity-30"}`}>
          {active && dir === "desc" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

function Kpi({
  label,
  value,
  color,
  onClick,
  active,
}: {
  label: string;
  value: number | string;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`text-left w-full bg-panel border rounded-xl px-3.5 py-3.5 transition ${
        onClick ? "cursor-pointer hover:border-teal/40 active:scale-[0.97]" : ""
      } ${active ? "border-teal/50 ring-1 ring-teal/30" : "border-border"}`}
    >
      <div className={`font-display text-[26px] leading-none font-semibold ${color || ""}`}>{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-muted mt-1.5">{label}</div>
    </div>
  );
}

function ProgressCircle({
  pct,
  total,
  completadas,
  progreso,
  pendientes,
  incidencias,
  hovered,
  onHoverChange,
}: {
  pct: number;
  total: number;
  completadas: number;
  progreso: number;
  pendientes: number;
  incidencias: number;
  hovered: string | null;
  onHoverChange: (key: string | null) => void;
}) {
  const size = 152;
  const stroke = 12;
  const gap = 3; // separación visual entre segmentos
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const reduceMotion = useReducedMotion();

  const mvPct = useMotionValue(0);
  const [display, setDisplay] = useState(0);
  const mvReveal = useMotionValue(reduceMotion ? 1 : 0);

  const base = total > 0 ? total : 1;
  const fCompletada = completadas / base;
  const fProgreso = progreso / base;
  const fPendiente = pendientes / base;
  const fIncidencia = incidencias / base;

  const startCompletada = 0;
  const startProgreso = fCompletada;
  const startPendiente = fCompletada + fProgreso;
  const startIncidencia = fCompletada + fProgreso + fPendiente;

  const lenCompletada = useTransform(mvReveal, (t) => Math.max(0, fCompletada * circumference * t - (fCompletada > 0 ? gap : 0)));
  const lenProgreso = useTransform(mvReveal, (t) => Math.max(0, fProgreso * circumference * t - (fProgreso > 0 ? gap : 0)));
  const lenPendiente = useTransform(mvReveal, (t) => Math.max(0, fPendiente * circumference * t - (fPendiente > 0 ? gap : 0)));
  const lenIncidencia = useTransform(mvReveal, (t) => Math.max(0, fIncidencia * circumference * t - (fIncidencia > 0 ? gap : 0)));

  const dashCompletada = useTransform(lenCompletada, (v) => `${v} ${circumference}`);
  const dashProgreso = useTransform(lenProgreso, (v) => `${v} ${circumference}`);
  const dashPendiente = useTransform(lenPendiente, (v) => `${v} ${circumference}`);
  const dashIncidencia = useTransform(lenIncidencia, (v) => `${v} ${circumference}`);

  const depsKey = `${total}-${completadas}-${progreso}-${pendientes}-${incidencias}`;

  function pctOf(value: number) {
    return total > 0 ? Math.round((value / total) * 100) : 0;
  }

  const segments = [
    { key: "COMPLETADA", label: "Completadas", color: ESTADO_COLOR.COMPLETADA, value: completadas, fraction: fCompletada, start: startCompletada, dash: dashCompletada },
    { key: "EN_PROGRESO", label: "En progreso", color: ESTADO_COLOR.EN_PROGRESO, value: progreso, fraction: fProgreso, start: startProgreso, dash: dashProgreso },
    { key: "PENDIENTE", label: "Pendientes", color: ESTADO_COLOR.PENDIENTE, value: pendientes, fraction: fPendiente, start: startPendiente, dash: dashPendiente },
    { key: "CON_INCIDENCIA", label: "Con incidencia", color: ESTADO_COLOR.CON_INCIDENCIA, value: incidencias, fraction: fIncidencia, start: startIncidencia, dash: dashIncidencia },
  ];
  const hoveredSeg = segments.find((s) => s.key === hovered) || null;

  useEffect(() => {
    if (reduceMotion) {
      mvPct.set(pct);
      setDisplay(pct);
      mvReveal.set(1);
      return;
    }
    const c1 = animate(mvPct, pct, {
      duration: 0.9,
      ease: "easeOut",
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    const c2 = animate(mvReveal, 1, { duration: 0.9, ease: "easeOut" });
    return () => {
      c1.stop();
      c2.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depsKey, reduceMotion]);

  return (
    <div className="relative flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#161C27" strokeWidth={stroke} fill="none" />
        {segments.map((seg) => (
          <motion.circle
            key={seg.key}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={seg.color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            opacity={hovered && hovered !== seg.key ? 0.35 : 1}
            style={{ strokeDasharray: seg.dash, strokeDashoffset: -seg.start * circumference, transition: "opacity 0.15s" }}
          />
        ))}
        {/* Aros invisibles más gruesos, solo para facilitar el hover/tap */}
        {segments.map((seg) => {
          if (seg.fraction <= 0) return null;
          const hitLen = Math.max(0, seg.fraction * circumference - gap);
          return (
            <circle
              key={`hit-${seg.key}`}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="transparent"
              strokeWidth={stroke + 16}
              fill="none"
              strokeDasharray={`${hitLen} ${circumference}`}
              strokeDashoffset={-seg.start * circumference}
              style={{ cursor: "pointer", pointerEvents: "stroke" }}
              onMouseEnter={() => onHoverChange(seg.key)}
              onMouseLeave={() => onHoverChange(null)}
              onClick={() => onHoverChange(hovered === seg.key ? null : seg.key)}
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center pointer-events-none">
        {hoveredSeg ? (
          <>
            <span className="font-display text-2xl font-bold leading-none">{hoveredSeg.value}</span>
            <span className="text-[10px] text-muted uppercase tracking-wide mt-1 text-center px-2">
              {hoveredSeg.label}
            </span>
            <span className="text-[11px] font-mono text-text mt-0.5">{pctOf(hoveredSeg.value)}%</span>
          </>
        ) : (
          <span className="font-display text-3xl font-bold">{display}%</span>
        )}
      </div>
    </div>
  );
}

function AvanceMigracionCard({
  data,
  selected,
  onSelect,
}: {
  data: { total: number; completadas: number; progreso: number; pendientes: number; incidencias: number; pct: number };
  selected: string;
  onSelect: (estado: string) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  function toggle(key: string) {
    onSelect(selected === key ? "" : key);
  }

  function pct(value: number) {
    return data.total > 0 ? Math.round((value / data.total) * 100) : 0;
  }

  return (
    <div className="bg-panel border border-border rounded-2xl p-5 h-full flex flex-col items-center">
      <h2 className="text-sm font-semibold font-display self-start mb-4">Avance de migración</h2>
      <ProgressCircle
        pct={data.pct}
        total={data.total}
        completadas={data.completadas}
        progreso={data.progreso}
        pendientes={data.pendientes}
        incidencias={data.incidencias}
        hovered={hovered}
        onHoverChange={setHovered}
      />
      <div className="mt-3 text-sm text-muted">
        <span className="font-mono text-text font-semibold">{data.completadas}</span> / {data.total} tiendas
      </div>
      <div className="w-full grid grid-cols-2 gap-1.5 mt-5">
        <LegendItem
          color={ESTADO_COLOR.COMPLETADA}
          label="Completadas"
          value={data.completadas}
          pct={pct(data.completadas)}
          active={selected === "COMPLETADA"}
          hovered={hovered === "COMPLETADA"}
          onClick={() => toggle("COMPLETADA")}
          onHover={() => setHovered("COMPLETADA")}
          onHoverEnd={() => setHovered(null)}
        />
        <LegendItem
          color={ESTADO_COLOR.EN_PROGRESO}
          label="En progreso"
          value={data.progreso}
          pct={pct(data.progreso)}
          active={selected === "EN_PROGRESO"}
          hovered={hovered === "EN_PROGRESO"}
          onClick={() => toggle("EN_PROGRESO")}
          onHover={() => setHovered("EN_PROGRESO")}
          onHoverEnd={() => setHovered(null)}
        />
        <LegendItem
          color={ESTADO_COLOR.PENDIENTE}
          label="Pendientes"
          value={data.pendientes}
          pct={pct(data.pendientes)}
          active={selected === "PENDIENTE"}
          hovered={hovered === "PENDIENTE"}
          onClick={() => toggle("PENDIENTE")}
          onHover={() => setHovered("PENDIENTE")}
          onHoverEnd={() => setHovered(null)}
        />
        <LegendItem
          color={ESTADO_COLOR.CON_INCIDENCIA}
          label="Con incidencia"
          value={data.incidencias}
          pct={pct(data.incidencias)}
          active={selected === "CON_INCIDENCIA"}
          hovered={hovered === "CON_INCIDENCIA"}
          onClick={() => toggle("CON_INCIDENCIA")}
          onHover={() => setHovered("CON_INCIDENCIA")}
          onHoverEnd={() => setHovered(null)}
        />
      </div>
    </div>
  );
}

function LegendItem({
  color,
  label,
  value,
  pct,
  active,
  hovered,
  onClick,
  onHover,
  onHoverEnd,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
  active?: boolean;
  hovered?: boolean;
  onClick: () => void;
  onHover?: () => void;
  onHoverEnd?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg transition text-left hover:bg-[#151C27] active:scale-[0.97] ${
        active || hovered ? "bg-[#151C27]" : ""
      }`}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
      <span className="text-xs text-muted flex-1 truncate">{label}</span>
      <span className="text-xs font-mono text-text">{value}</span>
      <span className="text-[10px] font-mono text-muted w-8 text-right">{pct}%</span>
    </button>
  );
}

function PaisAvanceChart({
  rows,
  onSelect,
}: {
  rows: { pais: string; total: number; completadas: number; pct: number }[];
  onSelect?: (pais: string) => void;
}) {
  return (
    <div className="bg-panel border border-border rounded-2xl p-4 h-full">
      <h2 className="text-sm font-semibold font-display mb-4">Avance por país</h2>
      <div className="space-y-3">
        {rows.map((r) => (
          <button
            type="button"
            key={r.pais}
            onClick={() => onSelect?.(r.pais)}
            className={`w-full flex items-center gap-3 -mx-1.5 px-1.5 py-0.5 rounded-lg transition text-left ${
              onSelect ? "cursor-pointer hover:bg-[#151C27] active:scale-[0.98]" : ""
            }`}
          >
            <span className="w-[100px] shrink-0 text-xs text-muted truncate" title={r.pais}>
              {r.pais}
            </span>
            <div className="flex-1 h-2.5 rounded-full bg-panel2 overflow-hidden">
              <div className="h-full rounded-full bg-teal" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="w-9 shrink-0 text-right text-xs font-mono text-text">{r.pct}%</span>
          </button>
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
    <div className="bg-panel border border-border rounded-2xl p-4">
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
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-[#151C27] active:bg-[#151C27] active:scale-[0.99] transition"
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

function FilterSheet({
  open,
  onClose,
  pais,
  setPais,
  region,
  setRegion,
  estado,
  setEstado,
  paises,
  regiones,
}: {
  open: boolean;
  onClose: () => void;
  pais: string;
  setPais: (v: string) => void;
  region: string;
  setRegion: (v: string) => void;
  estado: string;
  setEstado: (v: string) => void;
  paises: string[];
  regiones: string[];
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-40 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed bottom-0 left-0 right-0 z-50 bg-panel border-t border-border rounded-t-2xl p-5 pb-7 md:hidden"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide">Filtros</h3>
              <button onClick={onClose} className="text-muted text-xl leading-none px-2 active:text-text">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">País</label>
                <select
                  value={pais}
                  onChange={(e) => setPais(e.target.value)}
                  className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm"
                >
                  <option value="">Todos</option>
                  {paises.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">Región</label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm"
                >
                  <option value="">Todas</option>
                  {regiones.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">Estado</label>
                <select
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm"
                >
                  <option value="">Todos</option>
                  {Object.entries(ESTADO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full mt-5 bg-tealDim text-teal border border-teal/30 rounded-lg py-3 text-sm font-semibold active:bg-teal/20"
            >
              Aplicar filtros
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

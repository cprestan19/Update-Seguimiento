"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useProjectContext } from "@/components/ProjectProvider";
import {
  ESTADO_LABEL,
  ESTADO_BADGE,
  PRIORIDAD_LABEL,
  PRIORIDAD_BADGE,
  AREA_LABEL,
  TIPO_LABEL,
  ESTADOS_ORDENADOS,
  PRIORIDADES_ORDENADAS,
  AREAS_ORDENADAS,
  SLA_DOT,
  SLA_TEXT,
} from "@/lib/requirementLabels";

type Person = { id: string; name: string } | null;

type RequirementRow = {
  id: string;
  numero: string;
  titulo: string;
  tipo: string;
  area: string;
  prioridad: string;
  estado: string;
  impacto: string;
  bloqueado: boolean;
  departamentoSolicitante: string;
  liderProyecto: Person;
  responsableTecnico: Person;
  fechaEstimadaEntrega: string;
  fechaRealEntrega: string | null;
  sla: { color: string; label: string; vencido: boolean; proximoAVencer: boolean };
};

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}

export default function RequerimientosPage() {
  const { role } = useProjectContext();
  const isMonitor = role === "MONITOR";
  const [rows, setRows] = useState<RequirementRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [prioridad, setPrioridad] = useState("");
  const [area, setArea] = useState("");
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [soloProximos, setSoloProximos] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/requerimientos");
    if (res.ok) setRows(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  useRealtimeRefresh("requerimientos", load);

  const kpis = useMemo(() => {
    const total = rows.length;
    const pendientes = rows.filter((r) => r.estado === "SOLICITUD").length;
    const enAnalisis = rows.filter((r) => ["ANALISIS", "APROBADO"].includes(r.estado)).length;
    const enEjecucion = rows.filter((r) => ["EN_DESARROLLO", "EN_IMPLEMENTACION"].includes(r.estado)).length;
    const enPruebas = rows.filter((r) => r.estado === "EN_PRUEBAS").length;
    const implementados = rows.filter((r) => ["IMPLEMENTADO", "CERRADO"].includes(r.estado)).length;
    const vencidos = rows.filter((r) => r.sla.vencido).length;
    const proximosAVencer = rows.filter((r) => r.sla.proximoAVencer).length;
    return { total, pendientes, enAnalisis, enEjecucion, enPruebas, implementados, vencidos, proximosAVencer };
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (q) {
        const needle = q.toLowerCase();
        if (
          !r.numero.toLowerCase().includes(needle) &&
          !r.titulo.toLowerCase().includes(needle)
        ) {
          return false;
        }
      }
      if (estado && r.estado !== estado) return false;
      if (prioridad && r.prioridad !== prioridad) return false;
      if (area && r.area !== area) return false;
      if (soloVencidos && !r.sla.vencido) return false;
      if (soloProximos && !r.sla.proximoAVencer) return false;
      return true;
    });
  }, [rows, q, estado, prioridad, area, soloVencidos, soloProximos]);

  const filtrosActivos = [estado, prioridad, area].filter(Boolean).length + (soloVencidos ? 1 : 0) + (soloProximos ? 1 : 0);

  function limpiarFiltros() {
    setEstado("");
    setPrioridad("");
    setArea("");
    setSoloVencidos(false);
    setSoloProximos(false);
  }

  function renderRow(r: RequirementRow) {
    return (
      <tr key={r.id} className="border-b border-border last:border-none hover:bg-[#151C27]">
        <td className="px-4 py-2.5 font-mono text-xs text-muted">{r.numero}</td>
        <td className="px-4 py-2.5">
          <Link href={`/dashboard/requerimientos/${r.id}`} className="font-medium hover:text-teal">
            {r.titulo}
          </Link>
          <div className="text-[12px] text-muted">{AREA_LABEL[r.area]}</div>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[r.estado]}`}>
            {ESTADO_LABEL[r.estado]}
          </span>
        </td>
        <td className="px-4 py-2.5">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
            {PRIORIDAD_LABEL[r.prioridad]}
          </span>
        </td>
        <td className="px-4 py-2.5 text-sm">
          {r.responsableTecnico ? r.responsableTecnico.name : <span className="text-muted2 italic text-xs">Sin asignar</span>}
        </td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SLA_DOT[r.sla.color]}`} />
            <span className={`text-xs font-mono ${SLA_TEXT[r.sla.color]}`}>{formatFecha(r.fechaEstimadaEntrega)}</span>
          </div>
        </td>
      </tr>
    );
  }

  function renderCard(r: RequirementRow) {
    return (
      <Link
        key={r.id}
        href={`/dashboard/requerimientos/${r.id}`}
        className="block bg-panel border border-border rounded-xl p-3.5 active:bg-[#151C27] active:scale-[0.99] transition"
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[r.estado]}`}>
            {ESTADO_LABEL[r.estado]}
          </span>
          <span className="font-mono text-xs text-muted shrink-0">{r.numero}</span>
        </div>
        <div className="font-medium text-sm">{r.titulo}</div>
        <div className="text-xs text-muted mb-2.5">
          {AREA_LABEL[r.area]} · {TIPO_LABEL[r.tipo]}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${PRIORIDAD_BADGE[r.prioridad]}`}>
            {PRIORIDAD_LABEL[r.prioridad]}
          </span>
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${SLA_DOT[r.sla.color]}`} />
            <span className={`text-xs font-mono ${SLA_TEXT[r.sla.color]}`}>{formatFecha(r.fechaEstimadaEntrega)}</span>
          </div>
        </div>
        <div className="text-xs text-muted mt-2">
          {r.responsableTecnico ? r.responsableTecnico.name : "Sin técnico"}
        </div>
      </Link>
    );
  }

  if (loading) {
    return <div className="text-muted text-sm py-10 text-center">Cargando requerimientos...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
        <h1 className="font-display text-lg">Gestión de Requerimientos</h1>
        {!isMonitor && (
          <Link
            href="/dashboard/requerimientos/nuevo"
            className="bg-tealDim border border-teal/30 rounded-lg px-3 py-2 text-xs font-semibold text-teal hover:bg-teal/20 transition"
          >
            + Nuevo requerimiento
          </Link>
        )}
      </div>
      <p className="text-xs text-muted mb-6">Desarrollo, infraestructura, redes, implementaciones y más.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Total" value={kpis.total} />
        <Kpi label="Pendientes" value={kpis.pendientes} color="text-muted" />
        <Kpi label="En análisis" value={kpis.enAnalisis} color="text-blue" />
        <Kpi label="En ejecución" value={kpis.enEjecucion} color="text-blue" />
        <Kpi label="En pruebas" value={kpis.enPruebas} color="text-amber" />
        <Kpi label="Implementados" value={kpis.implementados} color="text-teal" />
        <Kpi
          label="Vencidos"
          value={kpis.vencidos}
          color="text-red"
          active={soloVencidos}
          onClick={() => setSoloVencidos((v) => !v)}
        />
        <Kpi
          label="Próx. a vencer"
          value={kpis.proximosAVencer}
          color="text-amber"
          active={soloProximos}
          onClick={() => setSoloProximos((v) => !v)}
        />
      </div>

      <div className="md:hidden flex gap-2 mb-4">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número o título..."
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

      <div className="hidden md:flex flex-wrap gap-2.5 mb-4 items-center">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por número o título..."
          className="bg-panel border border-border rounded-lg px-3 py-2 text-sm min-w-[220px] focus:outline-none focus:ring-2 focus:ring-blue"
        />
        <select value={estado} onChange={(e) => setEstado(e.target.value)} className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue">
          <option value="">Todos los estados</option>
          {ESTADOS_ORDENADOS.map((k) => (
            <option key={k} value={k}>
              {ESTADO_LABEL[k]}
            </option>
          ))}
        </select>
        <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue">
          <option value="">Toda prioridad</option>
          {PRIORIDADES_ORDENADAS.map((k) => (
            <option key={k} value={k}>
              {PRIORIDAD_LABEL[k]}
            </option>
          ))}
        </select>
        <select value={area} onChange={(e) => setArea(e.target.value)} className="bg-panel border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue">
          <option value="">Toda área</option>
          {AREAS_ORDENADAS.map((k) => (
            <option key={k} value={k}>
              {AREA_LABEL[k]}
            </option>
          ))}
        </select>
        {filtrosActivos > 0 && (
          <button onClick={limpiarFiltros} className="text-xs text-muted hover:text-text">
            Limpiar filtros
          </button>
        )}
        <span className="text-xs text-muted ml-auto">
          {filtered.length} de {rows.length} requerimientos
        </span>
      </div>

      <div className="md:hidden flex items-center justify-between mb-4">
        <span className="text-xs text-muted">
          {filtered.length} de {rows.length} requerimientos
        </span>
      </div>

      <div className="hidden md:block bg-panel border border-border rounded-2xl overflow-hidden overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-panel2 text-[11px] uppercase tracking-wide text-muted">
              <th className="text-left px-4 py-3 font-semibold">REQ</th>
              <th className="text-left px-4 py-3 font-semibold">Título</th>
              <th className="text-left px-4 py-3 font-semibold">Estado</th>
              <th className="text-left px-4 py-3 font-semibold">Prioridad</th>
              <th className="text-left px-4 py-3 font-semibold">Responsable</th>
              <th className="text-left px-4 py-3 font-semibold">Entrega</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => renderRow(r))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted text-sm">
                  {rows.length === 0 ? "Todavía no hay requerimientos." : "No hay requerimientos que coincidan con los filtros."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="md:hidden space-y-2.5">
        {filtered.map((r) => renderCard(r))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted text-center py-8">
            {rows.length === 0 ? "Todavía no hay requerimientos." : "No hay requerimientos que coincidan con los filtros."}
          </p>
        )}
      </div>

      {filtersOpen && (
        <FilterSheet
          onClose={() => setFiltersOpen(false)}
          estado={estado}
          setEstado={setEstado}
          prioridad={prioridad}
          setPrioridad={setPrioridad}
          area={area}
          setArea={setArea}
        />
      )}
    </div>
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
  value: number;
  color?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={`text-left w-full bg-panel border rounded-xl px-3.5 py-3.5 transition ${
        onClick ? "cursor-pointer hover:border-teal/40 active:scale-[0.97]" : ""
      } ${active ? "border-teal/50 ring-1 ring-teal/30" : "border-border"}`}
    >
      <div className={`font-display text-[22px] leading-none font-semibold ${color || ""}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide text-muted mt-1.5">{label}</div>
    </div>
  );
}

function FilterSheet({
  onClose,
  estado,
  setEstado,
  prioridad,
  setPrioridad,
  area,
  setArea,
}: {
  onClose: () => void;
  estado: string;
  setEstado: (v: string) => void;
  prioridad: string;
  setPrioridad: (v: string) => void;
  area: string;
  setArea: (v: string) => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-panel border-t border-border rounded-t-2xl p-5 pb-7 md:hidden">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-sm font-semibold uppercase tracking-wide">Filtros</h3>
          <button onClick={onClose} className="text-muted text-xl leading-none px-2 active:text-text">
            ✕
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">Estado</label>
            <select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm">
              <option value="">Todos</option>
              {ESTADOS_ORDENADOS.map((k) => (
                <option key={k} value={k}>
                  {ESTADO_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">Prioridad</label>
            <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm">
              <option value="">Todas</option>
              {PRIORIDADES_ORDENADAS.map((k) => (
                <option key={k} value={k}>
                  {PRIORIDAD_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-muted mb-1.5">Área</label>
            <select value={area} onChange={(e) => setArea(e.target.value)} className="w-full bg-panel2 border border-border rounded-lg px-3 py-3 text-sm">
              <option value="">Todas</option>
              {AREAS_ORDENADAS.map((k) => (
                <option key={k} value={k}>
                  {AREA_LABEL[k]}
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
      </div>
    </>
  );
}

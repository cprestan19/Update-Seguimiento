"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useProjectContext } from "@/components/ProjectProvider";

type Estado = "PENDIENTE" | "EN_SEGUIMIENTO" | "COMPLETADO";

type StoreRow = { id: string; region: string; tienda: string; pais: string };

type PersonRow = {
  id: string;
  name: string;
  personnelRole: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
  active: boolean;
};

type SeguimientoRow = {
  id: string;
  region: string;
  tienda: string | null;
  descripcion: string;
  estado: Estado;
  store: { id: string; region: string; tienda: string; pais: string } | null;
  responsable: { id: string; name: string; personnelRole: PersonRow["personnelRole"] } | null;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  TECNICO: "Técnico",
  AUDITOR_TI: "Auditor TI",
  AUDITOR_INVENTARIO: "Auditor Inventario",
  COORDINADOR: "Coordinador",
  INFRAESTRUCTURA: "Infraestructura",
};

const ESTADO_LABEL: Record<Estado, string> = {
  PENDIENTE: "Pendiente",
  EN_SEGUIMIENTO: "En seguimiento",
  COMPLETADO: "Completado",
};

const ESTADO_STYLE: Record<Estado, string> = {
  PENDIENTE: "!bg-amberDim !text-amber border !border-amber/30",
  EN_SEGUIMIENTO: "!bg-blueDim !text-blue border !border-blue/30",
  COMPLETADO: "!bg-greenDim !text-green border !border-green/30",
};

const EMPTY_FORM = { region: "", tienda: "", descripcion: "", responsableId: "" };

export default function SeguimientoPage() {
  const { role } = useProjectContext();
  const isMonitor = role === "MONITOR";

  const [items, setItems] = useState<SeguimientoRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [people, setPeople] = useState<PersonRow[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const [filterRegion, setFilterRegion] = useState("TODAS");
  const [filterEstado, setFilterEstado] = useState<"TODOS" | Estado>("TODOS");
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set());

  function toggleRegion(region: string) {
    setExpandedRegions((prev) => {
      const next = new Set(prev);
      if (next.has(region)) next.delete(region);
      else next.add(region);
      return next;
    });
  }

  const load = useCallback(async () => {
    const [itemsRes, storesRes, usersRes] = await Promise.all([
      fetch("/api/seguimiento"),
      fetch("/api/stores"),
      fetch("/api/users"),
    ]);
    if (itemsRes.ok) setItems(await itemsRes.json());
    if (storesRes.ok) setStores(await storesRes.json());
    if (usersRes.ok) setPeople(await usersRes.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("seguimiento", load);
  useRealtimeRefresh("stores", load);
  useRealtimeRefresh("users", load);

  const regionesExistentesStores = useMemo(
    () => Array.from(new Set(stores.map((s) => s.region))).sort(),
    [stores]
  );
  const tiendasExistentes = useMemo(
    () => Array.from(new Set(stores.map((s) => s.tienda))).sort(),
    [stores]
  );

  const regionesEnUso = useMemo(
    () => Array.from(new Set(items.map((it) => it.region))).sort(),
    [items]
  );

  const avancePorRegion = useMemo(() => {
    const map = new Map<string, { total: number; completados: number }>();
    for (const it of items) {
      if (!map.has(it.region)) map.set(it.region, { total: 0, completados: 0 });
      const e = map.get(it.region)!;
      e.total++;
      if (it.estado === "COMPLETADO") e.completados++;
    }
    return Array.from(map.entries())
      .map(([region, v]) => ({
        region,
        total: v.total,
        completados: v.completados,
        pct: v.total > 0 ? Math.round((v.completados / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.pct - a.pct);
  }, [items]);

  const activePeople = useMemo(() => people.filter((p) => p.active), [people]);

  const filteredItems = items.filter((it) => {
    if (filterRegion !== "TODAS" && it.region !== filterRegion) return false;
    if (filterEstado !== "TODOS" && it.estado !== filterEstado) return false;
    return true;
  });

  const grouped = useMemo(() => {
    const map = new Map<string, SeguimientoRow[]>();
    for (const it of filteredItems) {
      const key = it.region;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(it);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredItems]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.region.trim() || !form.descripcion.trim()) {
      setError("Indica la región y describe la corrección");
      return;
    }
    const res = await fetch("/api/seguimiento", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        region: form.region,
        tienda: form.tienda || null,
        descripcion: form.descripcion,
        responsableId: form.responsableId || null,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo guardar el seguimiento");
      return;
    }
    setForm(EMPTY_FORM);
    load();
  }

  async function updateEstado(id: string, estado: Estado) {
    await fetch(`/api/seguimiento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado }),
    });
    load();
  }

  async function updateResponsable(id: string, responsableId: string) {
    await fetch(`/api/seguimiento/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsableId: responsableId || null }),
    });
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este ítem de seguimiento?")) return;
    await fetch(`/api/seguimiento/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-lg mb-1">Seguimiento post-migración</h1>
      <p className="text-xs text-muted mb-6">
        Temas por corregir después del paso a Prism 2.4, organizados por región, con responsable y estado.
      </p>

      <div className="bg-panel border border-border rounded-2xl p-4 mb-6">
        <h2 className="text-sm font-semibold font-display mb-4">Avance de seguimiento por región</h2>
        <div className="space-y-3">
          {avancePorRegion.map((r) => (
            <button
              type="button"
              key={r.region}
              onClick={() => {
                setFilterRegion(r.region);
                setExpandedRegions(new Set([r.region]));
              }}
              className="w-full flex items-center gap-3 -mx-1.5 px-1.5 py-0.5 rounded-lg transition text-left hover:bg-panel2 active:scale-[0.98]"
            >
              <span className="w-[120px] shrink-0 text-xs text-muted truncate" title={r.region}>
                {r.region}
              </span>
              <div className="flex-1 h-2.5 rounded-full bg-panel2 overflow-hidden">
                <div className="h-full rounded-full bg-green" style={{ width: `${r.pct}%` }} />
              </div>
              <span className="w-9 shrink-0 text-right text-xs font-mono text-text">{r.pct}%</span>
              <span className="w-14 shrink-0 text-right text-[11px] text-muted">
                {r.completados}/{r.total}
              </span>
            </button>
          ))}
          {avancePorRegion.length === 0 && <p className="text-sm text-muted">Sin datos todavía.</p>}
        </div>
      </div>

      <datalist id="regiones-datalist">
        {regionesExistentesStores.map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>
      <datalist id="tiendas-datalist">
        <option value="Todos" />
        {tiendasExistentes.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      {!isMonitor && (
        <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-3">
            <Field label="Región">
              <input
                list="regiones-datalist"
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
                className="input"
                placeholder="Ej. Uruguay"
              />
            </Field>
            <Field label="Tienda (opcional)">
              <input
                list="tiendas-datalist"
                value={form.tienda}
                onChange={(e) => setForm({ ...form, tienda: e.target.value })}
                className="input"
                placeholder="Ej. Bodega Punta del Este, Todos..."
              />
            </Field>
            <Field label="Responsable (opcional)">
              <select
                value={form.responsableId}
                onChange={(e) => setForm({ ...form, responsableId: e.target.value })}
                className="input"
              >
                <option value="">Sin asignar</option>
                {activePeople.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.personnelRole ? ` — ${ROLE_LABEL[p.personnelRole]}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Descripción de la corrección">
              <input
                value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="input"
                placeholder="Ej. Ajustar inventario inicial en sistema"
              />
            </Field>
          </div>
          {error && <p className="text-xs text-red mb-2">{error}</p>}
          <button
            type="submit"
            className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20"
          >
            + Agregar a seguimiento
          </button>
        </form>
      )}

      <div className="flex items-center gap-3 flex-wrap mb-4">
        <Field label="Región">
          <select
            value={filterRegion}
            onChange={(e) => setFilterRegion(e.target.value)}
            className="input"
          >
            <option value="TODAS">Todas las regiones</option>
            {regionesEnUso.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Estado">
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value as "TODOS" | Estado)}
            className="input"
          >
            <option value="TODOS">Todos los estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="EN_SEGUIMIENTO">En seguimiento</option>
            <option value="COMPLETADO">Completado</option>
          </select>
        </Field>
        {grouped.length > 0 && (
          <button
            type="button"
            onClick={() =>
              setExpandedRegions((prev) =>
                prev.size === grouped.length ? new Set() : new Set(grouped.map(([r]) => r))
              )
            }
            className="text-xs text-muted hover:text-text ml-auto"
          >
            {expandedRegions.size === grouped.length ? "Colapsar todo" : "Expandir todo"}
          </button>
        )}
      </div>

      {grouped.length === 0 && (
        <div className="text-sm text-muted text-center py-10 border border-border rounded-2xl bg-panel">
          No hay ítems de seguimiento{filterRegion !== "TODAS" || filterEstado !== "TODOS" ? " con estos filtros" : " todavía"}.
        </div>
      )}

      <div className="space-y-3">
        {grouped.map(([region, rows]) => {
          const expanded = expandedRegions.has(region);
          return (
          <div key={region} className="bg-panel border border-border rounded-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => toggleRegion(region)}
              className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-panel2 transition"
            >
              <span className={`text-muted text-xs transition-transform ${expanded ? "rotate-90" : ""}`}>▶</span>
              <span className="text-xs uppercase tracking-wide text-muted font-semibold">{region}</span>
              <span className="text-[11px] text-muted2">· {rows.length}</span>
            </button>
            {expanded && (
            <div className="divide-y divide-border border-t border-border">
              {rows.map((it) => (
                <div key={it.id} className="flex items-start gap-3 px-4 py-3 flex-wrap">
                  <div className="min-w-[150px]">
                    <div className="text-sm font-medium">{it.tienda || "General / Todos"}</div>
                    {it.store && <div className="text-[11px] text-muted">{it.store.pais}</div>}
                  </div>

                  <div className="flex-1 min-w-[220px] text-sm text-text">{it.descripcion}</div>

                  <div className="min-w-[190px]">
                    {isMonitor ? (
                      <span className="text-xs text-muted">
                        {it.responsable
                          ? `${it.responsable.name}${
                              it.responsable.personnelRole ? ` — ${ROLE_LABEL[it.responsable.personnelRole]}` : ""
                            }`
                          : "Sin asignar"}
                      </span>
                    ) : (
                      <select
                        value={it.responsable?.id || ""}
                        onChange={(e) => updateResponsable(it.id, e.target.value)}
                        className="input !py-1 !text-xs"
                      >
                        <option value="">Sin asignar</option>
                        {/* Si el responsable ya fue dado de baja no esta en activePeople:
                            se agrega igual para no perder el registro de quien lo tenia. */}
                        {it.responsable && !activePeople.some((p) => p.id === it.responsable!.id) && (
                          <option value={it.responsable.id}>{it.responsable.name} (de baja)</option>
                        )}
                        {activePeople.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                            {p.personnelRole ? ` — ${ROLE_LABEL[p.personnelRole]}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="min-w-[170px]">
                    {isMonitor ? (
                      <span
                        className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${ESTADO_STYLE[it.estado]}`}
                      >
                        {ESTADO_LABEL[it.estado]}
                      </span>
                    ) : (
                      <select
                        value={it.estado}
                        onChange={(e) => updateEstado(it.id, e.target.value as Estado)}
                        className={`input !py-1 !text-xs !w-auto ${ESTADO_STYLE[it.estado]}`}
                      >
                        <option value="PENDIENTE">Pendiente</option>
                        <option value="EN_SEGUIMIENTO">En seguimiento</option>
                        <option value="COMPLETADO">Completado</option>
                      </select>
                    )}
                  </div>

                  {!isMonitor && (
                    <button
                      onClick={() => remove(it.id)}
                      className="text-muted hover:text-red text-xs ml-auto"
                      title="Eliminar"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
            )}
          </div>
          );
        })}
      </div>

      <style jsx global>{`
        .input {
          background: #161c27;
          border: 1px solid #212b39;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 13px;
          width: 100%;
          color: #e6edf3;
        }
        .input:focus {
          outline: 2px solid #3b9eff;
        }
      `}</style>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wide text-muted mb-1">{label}</label>
      {children}
    </div>
  );
}

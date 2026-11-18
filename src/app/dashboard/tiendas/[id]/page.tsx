"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useProjectContext } from "@/components/ProjectProvider";

type Person = { id: string; name: string };

type ChecklistRow = {
  id: string;
  completado: boolean;
  noAplica: boolean;
  completadoPor: { name: string } | null;
  completadoEn: string | null;
  valor: string | null;
  itemDef: {
    id: string;
    nombre: string;
    orden: number;
    tipo: "CHECK" | "DATO" | "NOTA";
    storeId: string | null;
    region: string | null;
    category: { nombre: string; orden: number };
  };
};

type Incident = {
  id: string;
  severidad: string;
  descripcion: string;
  resuelta: boolean;
  createdAt: string;
  createdBy: { name: string } | null;
};

type StoreDetail = {
  id: string;
  pais: string;
  region: string;
  tienda: string;
  horario: string;
  estado: string;
  tecnico: Person | null;
  auditorTI: Person | null;
  auditorInv: Person | null;
  tiempoEstimadoMin: number;
  inicioReal: string | null;
  finReal: string | null;
  duracionRealMin: number | null;
  inventarioInicial: number | null;
  inventarioFinal: number | null;
  costoInicial: number | null;
  costoFinal: number | null;
  checklist: ChecklistRow[];
  incidents: Incident[];
};

function toDatetimeLocalValue(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

// Si aún no hay hora de inicio registrada, precarga la fecha de hoy (con
// hora en blanco) para que la persona solo tenga que escribir la hora.
function defaultInicioLocal(): string {
  const local = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return `${local.toISOString().slice(0, 10)}T00:00`;
}

function minutosEntre(inicio: string | null, fin: string | null): number {
  if (!inicio) return 0;
  const start = new Date(inicio).getTime();
  const end = fin ? new Date(fin).getTime() : Date.now();
  return Math.max(0, Math.round((end - start) / 60000));
}

function formatHorasMinutos(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h <= 0) return `${m} min`;
  return `${h}h ${m}min`;
}

function formatFechaHora(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-PA", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADA: "Completada",
  CON_INCIDENCIA: "Con incidencia",
};

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useProjectContext();
  const isMonitor = role === "MONITOR";
  const isAdmin = role === "ADMIN";
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [regionError, setRegionError] = useState<string | null>(null);
  const [regionesConocidas, setRegionesConocidas] = useState<string[]>([]);

  const [store, setStore] = useState<StoreDetail | null>(null);
  const [tecnicos, setTecnicos] = useState<Person[]>([]);
  const [auditoresTI, setAuditoresTI] = useState<Person[]>([]);
  const [auditoresInv, setAuditoresInv] = useState<Person[]>([]);
  const [newIncidentText, setNewIncidentText] = useState("");
  const [newIncidentSev, setNewIncidentSev] = useState("MEDIA");
  const [inventarioInicial, setInventarioInicial] = useState("");
  const [inventarioFinal, setInventarioFinal] = useState("");
  const [costoInicial, setCostoInicial] = useState("");
  const [costoFinal, setCostoFinal] = useState("");
  const [inicioReal, setInicioReal] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${id}`);
    if (res.ok) setStore(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("stores", load);

  useEffect(() => {
    if (!store) return;
    setInventarioInicial(store.inventarioInicial != null ? String(store.inventarioInicial) : "");
    setInventarioFinal(store.inventarioFinal != null ? String(store.inventarioFinal) : "");
    setCostoInicial(store.costoInicial != null ? String(store.costoInicial) : "");
    setCostoFinal(store.costoFinal != null ? String(store.costoFinal) : "");
    setInicioReal(store.inicioReal ? toDatetimeLocalValue(store.inicioReal) : defaultInicioLocal());
    // Solo re-sincroniza al cambiar de tienda, para no pisar lo que el usuario está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  // Solo personal activo es asignable; a quien esta de baja se le conserva la
  // asignacion que ya tenia (ver AssignField).
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: any[]) => {
        const activos = users.filter((u) => u.active);
        setTecnicos(activos.filter((u) => u.personnelRole === "TECNICO"));
        setAuditoresTI(activos.filter((u) => u.personnelRole === "AUDITOR_TI"));
        setAuditoresInv(activos.filter((u) => u.personnelRole === "AUDITOR_INVENTARIO"));
      });
  }, []);

  // Sugerencias de región (autocompletado) a partir de las regiones que ya
  // existen en este proyecto — la región es texto libre (ej. "CK Panama"),
  // no una lista cerrada, así que no se restringe, solo se sugiere.
  useEffect(() => {
    fetch("/api/stores")
      .then((r) => r.json())
      .then((stores: { region: string }[]) => {
        setRegionesConocidas([...new Set(stores.map((s) => s.region))].sort((a, b) => a.localeCompare(b, "es")));
      });
  }, []);

  if (!store) return <div className="text-muted text-sm py-10 text-center">Cargando...</div>;

  const aplicables = store.checklist.filter((c) => !c.noAplica);
  const total = aplicables.length;
  const done = aplicables.filter((c) => c.completado).length;
  const pct = total ? Math.round((done / total) * 100) : 100;

  const categories = Array.from(
    new Map(store.checklist.map((c) => [c.itemDef.category.nombre, c.itemDef.category.orden])).entries()
  ).sort((a, b) => a[1] - b[1]);

  const sinProgreso =
    store.estado === "PENDIENTE" &&
    !store.inicioReal &&
    !store.checklist.some((c) => c.completado) &&
    store.incidents.length === 0;

  async function deleteCategoria() {
    if (!confirm(`¿Eliminar "${store!.tienda}"? Esta acción no se puede deshacer.`)) return;
    setDeleteError(null);
    setDeleting(true);
    const res = await fetch(`/api/stores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setDeleteError(data.error || "No se pudo eliminar la categoría");
      setDeleting(false);
      return;
    }
    router.push("/dashboard");
  }

  async function saveRegion(nuevaRegion: string) {
    setRegionError(null);
    const res = await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ region: nuevaRegion }),
    });
    if (!res.ok) {
      const data = await res.json();
      setRegionError(data.error || "No se pudo cambiar la región");
      return;
    }
    load();
  }

  async function toggle(storeChecklistItemId: string) {
    await fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeChecklistItemId }),
    });
    load();
  }

  async function saveValor(storeChecklistItemId: string, valor: string) {
    await fetch("/api/checklist/items", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeChecklistItemId, valor }),
    });
    load();
  }

  async function renameCriterio(it: ChecklistRow) {
    const compartido = !it.itemDef.storeId;
    const nombre = prompt(
      compartido
        ? "Nuevo nombre (este criterio es compartido: se cambia en todas las tiendas que lo tienen):"
        : "Nuevo nombre del criterio:",
      it.itemDef.nombre
    );
    if (!nombre || nombre.trim() === it.itemDef.nombre) return;
    await fetch(`/api/checklist/defs/${it.itemDef.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    load();
  }

  async function deleteCriterio(it: ChecklistRow) {
    if (!confirm(`¿Quitar el criterio "${it.itemDef.nombre}" de esta categoría?`)) return;
    await fetch("/api/checklist/items", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeChecklistItemId: it.id }),
    });
    load();
  }

  async function toggleNoAplica(storeChecklistItemId: string) {
    await fetch("/api/checklist/no-aplica", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeChecklistItemId }),
    });
    load();
  }

  async function assign(field: "tecnicoId" | "auditorTIId" | "auditorInvId", value: string) {
    await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value || null }),
    });
    load();
  }

  async function addIncident() {
    if (!newIncidentText.trim()) return;
    await fetch("/api/incidents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: id, severidad: newIncidentSev, descripcion: newIncidentText }),
    });
    setNewIncidentText("");
    load();
  }

  async function resolveIncident(incidentId: string) {
    await fetch(`/api/incidents/${incidentId}`, { method: "PATCH" });
    load();
  }

  async function saveCampoTienda(
    field: "inventarioInicial" | "inventarioFinal" | "costoInicial" | "costoFinal",
    value: string
  ) {
    await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value === "" ? null : Number(value) }),
    });
  }

  async function saveInicioReal(value: string) {
    const iso = value ? new Date(value).toISOString() : null;
    await fetch(`/api/stores/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inicioReal: iso }),
    });
    load();
  }

  const inventarioNum = {
    inicial: inventarioInicial === "" ? null : Number(inventarioInicial),
    final: inventarioFinal === "" ? null : Number(inventarioFinal),
  };
  const inventarioCoincide =
    inventarioNum.inicial != null && inventarioNum.final != null
      ? inventarioNum.inicial === inventarioNum.final
      : null;

  const costoNum = {
    inicial: costoInicial === "" ? null : Number(costoInicial),
    final: costoFinal === "" ? null : Number(costoFinal),
  };
  const costoCoincide =
    costoNum.inicial != null && costoNum.final != null ? costoNum.inicial === costoNum.final : null;

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/dashboard")} className="text-xs text-muted hover:text-text">
          &larr; Volver al dashboard
        </button>
        {isAdmin && (
          <button
            onClick={deleteCategoria}
            disabled={!sinProgreso || deleting}
            title={sinProgreso ? "Eliminar categoría" : "Solo se puede eliminar si no tiene progreso"}
            className="text-xs text-red hover:underline disabled:text-muted2 disabled:no-underline disabled:cursor-not-allowed"
          >
            {deleting ? "Eliminando..." : "Eliminar categoría"}
          </button>
        )}
      </div>
      {deleteError && <p className="text-xs text-red mb-3">{deleteError}</p>}

      <div className="text-[11px] uppercase tracking-wide text-muted flex items-center gap-1">
        <span>{store.pais} ·</span>
        {isAdmin ? (
          <>
            <input
              key={store.region}
              list="regiones-conocidas"
              defaultValue={store.region}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v && v !== store.region) saveRegion(v);
                else e.target.value = store.region;
              }}
              title="Cambiar la región de esta categoría"
              className="bg-transparent border-b border-dashed border-muted2 hover:border-teal focus:border-teal focus:outline-none uppercase tracking-wide text-[11px] text-muted px-0.5 min-w-[80px]"
            />
            <datalist id="regiones-conocidas">
              {regionesConocidas.map((r) => (
                <option key={r} value={r} />
              ))}
            </datalist>
          </>
        ) : (
          <span>{store.region}</span>
        )}
      </div>
      {regionError && <p className="text-xs text-red -mt-1 mb-1">{regionError}</p>}
      <h1 className="font-display text-xl mt-1">{store.tienda}</h1>
      <div className="text-xs text-muted mt-1">
        Ventana: <span className="font-mono">{store.horario}</span> · {ESTADO_LABEL[store.estado]}
      </div>

      <div className="my-5">
        <div className="font-mono text-2xl font-semibold text-teal">{pct}%</div>
        <div className="h-2 rounded bg-panel2 overflow-hidden mt-1.5">
          <div className="h-full bg-teal rounded" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 mb-6">
        <AssignField
          label="Técnico"
          value={store.tecnico}
          options={tecnicos}
          editable={!isMonitor}
          onChange={(v) => assign("tecnicoId", v)}
        />
        <AssignField
          label="Auditor TI"
          value={store.auditorTI}
          options={auditoresTI}
          editable={!isMonitor}
          onChange={(v) => assign("auditorTIId", v)}
        />
        <AssignField
          label="Auditor inventario"
          value={store.auditorInv}
          options={auditoresInv}
          editable={!isMonitor}
          onChange={(v) => assign("auditorInvId", v)}
        />
        <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Tiempo</div>
          <div className="text-sm font-mono">
            {store.duracionRealMin != null ? (
              `${formatHorasMinutos(store.duracionRealMin)} reales`
            ) : store.inicioReal ? (
              `${formatHorasMinutos(minutosEntre(store.inicioReal, null))} (en curso)`
            ) : (
              `Est. ${formatHorasMinutos(store.tiempoEstimadoMin)}`
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-xs uppercase tracking-wide text-muted mb-2.5">Inventario</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Inicial</div>
            <input
              type="number"
              inputMode="numeric"
              value={inventarioInicial}
              onChange={(e) => setInventarioInicial(e.target.value)}
              onBlur={(e) => saveCampoTienda("inventarioInicial", e.target.value)}
              disabled={isMonitor}
              placeholder="Sin registrar"
              className="w-full bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted2 placeholder:italic placeholder:text-xs"
            />
          </div>
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Final</div>
            <input
              type="number"
              inputMode="numeric"
              value={inventarioFinal}
              onChange={(e) => setInventarioFinal(e.target.value)}
              onBlur={(e) => saveCampoTienda("inventarioFinal", e.target.value)}
              disabled={isMonitor}
              placeholder="Sin registrar"
              className="w-full bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted2 placeholder:italic placeholder:text-xs"
            />
          </div>
        </div>
        {inventarioCoincide !== null && (
          <p className={`text-xs mt-2 ${inventarioCoincide ? "text-teal" : "text-amber"}`}>
            {inventarioCoincide
              ? "✓ Coincide"
              : `⚠ Diferencia de ${Math.abs((inventarioNum.inicial as number) - (inventarioNum.final as number))} unidades`}
          </p>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-xs uppercase tracking-wide text-muted mb-2.5">Costo</h3>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Inicial</div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted2">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={costoInicial}
                onChange={(e) => setCostoInicial(e.target.value)}
                onBlur={(e) => saveCampoTienda("costoInicial", e.target.value)}
                disabled={isMonitor}
                placeholder="Sin registrar"
                className="w-full bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted2 placeholder:italic placeholder:text-xs"
              />
            </div>
          </div>
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Final</div>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted2">$</span>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={costoFinal}
                onChange={(e) => setCostoFinal(e.target.value)}
                onBlur={(e) => saveCampoTienda("costoFinal", e.target.value)}
                disabled={isMonitor}
                placeholder="Sin registrar"
                className="w-full bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted2 placeholder:italic placeholder:text-xs"
              />
            </div>
          </div>
        </div>
        {costoCoincide !== null && (
          <p className={`text-xs mt-2 ${costoCoincide ? "text-teal" : "text-amber"}`}>
            {costoCoincide
              ? "✓ Coincide"
              : `⚠ Diferencia de $${Math.abs((costoNum.inicial as number) - (costoNum.final as number)).toFixed(2)}`}
          </p>
        )}
      </div>

      <div className="mb-6">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Hora de inicio</div>
            <input
              type="datetime-local"
              value={inicioReal}
              onChange={(e) => setInicioReal(e.target.value)}
              onBlur={(e) => saveInicioReal(e.target.value)}
              disabled={isMonitor}
              className="w-full bg-transparent text-sm font-mono focus:outline-none [color-scheme:dark]"
            />
          </div>
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Hora de completado</div>
            <div className="text-sm font-mono py-[3px]">
              {store.finReal ? (
                formatFechaHora(store.finReal)
              ) : (
                <span className="text-muted2 italic text-xs">Sin completar</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {categories.map(([catName]) => {
        const items = store.checklist
          .filter((c) => c.itemDef.category.nombre === catName)
          .sort((a, b) => a.itemDef.orden - b.itemDef.orden);
        const catAplicables = items.filter((i) => !i.noAplica);
        const catDone = catAplicables.filter((i) => i.completado).length;
        return (
          <div key={catName} className="mb-4">
            <div className="flex justify-between text-xs uppercase tracking-wide text-muted border-b border-border pb-2 mb-2">
              <span className="text-text font-semibold">{catName}</span>
              <span>
                {catDone}/{catAplicables.length}
              </span>
            </div>
            {items.map((it) =>
              it.itemDef.tipo !== "CHECK" ? (
                <ValorRow
                  key={it.id}
                  item={it}
                  editable={!isMonitor}
                  isAdmin={isAdmin}
                  onSave={(v) => saveValor(it.id, v)}
                  onDelete={() => deleteCriterio(it)}
                  onRename={() => renameCriterio(it)}
                />
              ) : (
              <div
                key={it.id}
                className={`flex items-center gap-2.5 py-1.5 px-1 rounded ${
                  it.noAplica ? "opacity-50" : "hover:bg-[#141A24]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.completado}
                  disabled={it.noAplica || isMonitor}
                  onChange={() => toggle(it.id)}
                  className="w-[18px] h-[18px] rounded accent-teal disabled:cursor-not-allowed"
                />
                <span
                  onClick={() => !it.noAplica && !isMonitor && toggle(it.id)}
                  className={`text-sm flex-1 ${!it.noAplica && !isMonitor ? "cursor-pointer" : ""} ${
                    it.completado || it.noAplica ? "line-through text-muted" : ""
                  } ${it.noAplica ? "italic" : ""}`}
                >
                  {it.itemDef.nombre}
                </span>
                {it.completado && it.completadoPor && !it.noAplica && (
                  <span className="text-[10px] text-muted2">{it.completadoPor.name}</span>
                )}
                {!isMonitor && (
                  <button
                    type="button"
                    onClick={() => toggleNoAplica(it.id)}
                    className={`shrink-0 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border transition ${
                      it.noAplica
                        ? "bg-amberDim text-amber border-amber/30"
                        : "text-muted2 border-border hover:text-amber hover:border-amber/40"
                    }`}
                    title={it.noAplica ? "Volver a marcar como aplicable" : "Marcar como no aplica"}
                  >
                    No aplica
                  </button>
                )}
                {isAdmin && (
                  <CriterioAdminButtons
                    item={it}
                    onRename={() => renameCriterio(it)}
                    onDelete={() => deleteCriterio(it)}
                  />
                )}
              </div>
              )
            )}
          </div>
        );
      })}

      {isAdmin && (
        <AddCriterioForm
          storeId={store.id}
          region={store.region}
          secciones={categories.map(([n]) => n)}
          onAdded={load}
        />
      )}

      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-xs uppercase tracking-wide text-muted mb-2.5">Incidencias</h3>
        {store.incidents.length === 0 && (
          <p className="text-xs text-muted2 italic">Sin incidencias registradas.</p>
        )}
        {store.incidents.map((inc) => (
          <div
            key={inc.id}
            className={`rounded-lg p-3 mb-2 text-xs ${
              inc.resuelta ? "bg-panel2 border border-border" : "bg-redDim border border-[#4A1C24]"
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className={`font-semibold uppercase text-[11px] ${inc.resuelta ? "text-muted" : "text-red"}`}>
                {inc.severidad} {inc.resuelta && "· Resuelta"}
              </span>
              {!inc.resuelta && !isMonitor && (
                <button onClick={() => resolveIncident(inc.id)} className="text-teal text-[11px] hover:underline">
                  Marcar resuelta
                </button>
              )}
            </div>
            <div className="mt-1">{inc.descripcion}</div>
            {inc.createdBy && <div className="text-muted2 mt-1">— {inc.createdBy.name}</div>}
          </div>
        ))}
        {!isMonitor && (
          <div className="flex gap-2 mt-3">
            <select
              value={newIncidentSev}
              onChange={(e) => setNewIncidentSev(e.target.value)}
              className="bg-panel2 border border-border rounded-lg px-2 text-xs"
            >
              <option value="BAJA">Baja</option>
              <option value="MEDIA">Media</option>
              <option value="ALTA">Alta</option>
              <option value="CRITICA">Crítica</option>
            </select>
            <input
              value={newIncidentText}
              onChange={(e) => setNewIncidentText(e.target.value)}
              placeholder="Describir nueva incidencia..."
              className="flex-1 bg-panel2 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <button
              onClick={addIncident}
              className="bg-redDim text-red border border-[#4A1C24] rounded-lg px-3 text-xs font-semibold"
            >
              Registrar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Etiqueta de alcance + botones de renombrar / quitar de esta tienda (ADMIN).
function CriterioAdminButtons({
  item,
  onRename,
  onDelete,
}: {
  item: ChecklistRow;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { storeId, region } = item.itemDef;
  const alcance = storeId ? "Solo aquí" : region ? `Región` : null;
  return (
    <>
      {alcance && (
        <span
          className="shrink-0 text-[9px] uppercase tracking-wide text-muted2 border border-border rounded-full px-1.5 py-0.5"
          title={storeId ? "Criterio propio de esta categoría" : `Criterio de la región ${region}`}
        >
          {alcance}
        </span>
      )}
      <button
        type="button"
        onClick={onRename}
        className="shrink-0 text-muted2 hover:text-blue text-sm leading-none px-1"
        title="Renombrar criterio"
        aria-label="Renombrar criterio"
      >
        ✎
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="shrink-0 text-muted2 hover:text-red text-sm leading-none px-1"
        title="Quitar este criterio de esta categoría"
        aria-label="Quitar criterio"
      >
        ✕
      </button>
    </>
  );
}

// Criterio tipo DATO (campo corto, cuenta como completado al llenarse) o
// NOTA (comentario libre, no afecta el progreso). Guarda al salir del campo.
function ValorRow({
  item,
  editable,
  isAdmin,
  onSave,
  onDelete,
  onRename,
}: {
  item: ChecklistRow;
  editable: boolean;
  isAdmin: boolean;
  onSave: (v: string) => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const [value, setValue] = useState(item.valor || "");
  useEffect(() => setValue(item.valor || ""), [item.valor]);
  const isNota = item.itemDef.tipo === "NOTA";
  const dirty = value.trim() !== (item.valor || "");
  const save = () => dirty && onSave(value);

  return (
    <div className="py-1.5 px-1">
      <div className="flex items-center gap-2.5 mb-1">
        {!isNota && (
          <span
            className={`w-[18px] h-[18px] shrink-0 rounded border flex items-center justify-center text-[11px] ${
              item.completado ? "bg-teal/20 border-teal text-teal" : "border-border"
            }`}
            title={item.completado ? "Completado" : "Pendiente: escribe el dato"}
          >
            {item.completado ? "✓" : ""}
          </span>
        )}
        <span className="text-sm flex-1">{item.itemDef.nombre}</span>
        {item.completadoPor && item.valor && (
          <span className="text-[10px] text-muted2">{item.completadoPor.name}</span>
        )}
        {isAdmin && <CriterioAdminButtons item={item} onRename={onRename} onDelete={onDelete} />}
      </div>
      {isNota ? (
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          disabled={!editable}
          rows={3}
          placeholder={editable ? "Escribe aquí..." : "Sin comentarios"}
          className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue disabled:opacity-70"
        />
      ) : (
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          disabled={!editable}
          placeholder={editable ? "Escribe el dato y presiona Enter" : "Sin dato"}
          className="w-full bg-panel2 border border-border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue disabled:opacity-70"
        />
      )}
      {dirty && editable && <p className="text-[10px] text-amber mt-0.5">Sin guardar: sal del campo para guardar</p>}
    </div>
  );
}

const NUEVA_SECCION = "__nueva__";

function AddCriterioForm({
  storeId,
  region,
  secciones,
  onAdded,
}: {
  storeId: string;
  region: string;
  secciones: string[];
  onAdded: () => void;
}) {
  const [alcance, setAlcance] = useState<"STORE" | "REGION" | "PROJECT">("STORE");
  const [nombre, setNombre] = useState("");
  const [seccion, setSeccion] = useState(secciones[secciones.length - 1] || NUEVA_SECCION);
  const [nuevaSeccion, setNuevaSeccion] = useState("");
  const [tipo, setTipo] = useState<"CHECK" | "DATO" | "NOTA">("CHECK");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const seccionFinal = seccion === NUEVA_SECCION ? nuevaSeccion.trim() : seccion;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!nombre.trim() || !seccionFinal) {
      setError("Escribe el criterio y la sección");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/checklist/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId, nombre, seccion: seccionFinal, tipo, alcance }),
    });
    setSaving(false);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "No se pudo agregar el criterio");
      return;
    }
    setInfo(alcance === "STORE" ? null : `Agregado a ${data.tiendas} tiendas.`);
    setNombre("");
    if (seccion === NUEVA_SECCION) {
      setSeccion(seccionFinal);
      setNuevaSeccion("");
    }
    onAdded();
  }

  const inputCls =
    "bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue";

  return (
    <form onSubmit={submit} className="mt-2 mb-4 bg-panel border border-border rounded-xl p-3">
      <h3 className="text-xs font-semibold font-display mb-2">+ Agregar criterio</h3>
      <div className="flex gap-2 flex-wrap">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej. Verificación de antenas de robo"
          className={`${inputCls} flex-1 min-w-[200px]`}
        />
        <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className={inputCls}>
          {secciones.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={NUEVA_SECCION}>Nueva sección…</option>
        </select>
        {seccion === NUEVA_SECCION && (
          <input
            value={nuevaSeccion}
            onChange={(e) => setNuevaSeccion(e.target.value)}
            placeholder="Nombre de la sección"
            className={`${inputCls} min-w-[160px]`}
          />
        )}
        <select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as "CHECK" | "DATO" | "NOTA")}
          className={inputCls}
        >
          <option value="CHECK">Casilla (check)</option>
          <option value="DATO">Dato (campo de texto)</option>
          <option value="NOTA">Comentario libre</option>
        </select>
        <select
          value={alcance}
          onChange={(e) => setAlcance(e.target.value as "STORE" | "REGION" | "PROJECT")}
          className={inputCls}
        >
          <option value="STORE">Solo esta categoría</option>
          <option value="REGION">Toda la región: {region}</option>
          <option value="PROJECT">Todas las categorías del proyecto</option>
        </select>
        <button
          type="submit"
          disabled={saving}
          className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
        >
          {saving ? "Agregando..." : "Agregar"}
        </button>
      </div>
      <p className="text-[10px] text-muted2 mt-1.5">
        Región y proyecto también aplican a las categorías que se creen después. Un “Dato” cuenta como completado
        cuando se llena; un comentario no afecta el progreso.
      </p>
      {info && <p className="text-xs text-teal mt-1.5">{info}</p>}
      {error && <p className="text-xs text-red mt-1.5">{error}</p>}
    </form>
  );
}

function AssignField({
  label,
  value,
  options,
  editable,
  onChange,
}: {
  label: string;
  value: Person | null;
  options: Person[];
  editable: boolean;
  onChange: (v: string) => void;
}) {
  // Si la persona asignada ya fue dada de baja no viene en options: se agrega
  // igual para no perder de vista quien hizo el trabajo.
  const deBaja = value && !options.some((o) => o.id === value.id) ? value : null;

  return (
    <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      {editable ? (
        <select
          value={value?.id || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent text-sm focus:outline-none"
        >
          <option value="">Sin asignar</option>
          {deBaja && <option value={deBaja.id}>{deBaja.name} (de baja)</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : (
        <div className={`text-sm ${!value ? "text-muted2 italic" : ""}`}>
          {value ? `${value.name}${deBaja ? " (de baja)" : ""}` : "Sin asignar"}
        </div>
      )}
    </div>
  );
}

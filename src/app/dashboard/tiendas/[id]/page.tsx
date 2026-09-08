"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams, useRouter } from "next/navigation";

type Person = { id: string; name: string };

type ChecklistRow = {
  id: string;
  completado: boolean;
  noAplica: boolean;
  completadoPor: { name: string } | null;
  completadoEn: string | null;
  itemDef: { nombre: string; category: { nombre: string; orden: number } };
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
  duracionRealMin: number | null;
  inventarioInicial: number | null;
  inventarioFinal: number | null;
  costoInicial: number | null;
  costoFinal: number | null;
  checklist: ChecklistRow[];
  incidents: Incident[];
};

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: "Pendiente",
  EN_PROGRESO: "En progreso",
  COMPLETADA: "Completada",
  CON_INCIDENCIA: "Con incidencia",
};

export default function StoreDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "ADMIN";

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

  const load = useCallback(async () => {
    const res = await fetch(`/api/stores/${id}`);
    if (res.ok) setStore(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!store) return;
    setInventarioInicial(store.inventarioInicial != null ? String(store.inventarioInicial) : "");
    setInventarioFinal(store.inventarioFinal != null ? String(store.inventarioFinal) : "");
    setCostoInicial(store.costoInicial != null ? String(store.costoInicial) : "");
    setCostoFinal(store.costoFinal != null ? String(store.costoFinal) : "");
    // Solo re-sincroniza al cambiar de tienda, para no pisar lo que el usuario está escribiendo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: any[]) => {
        setTecnicos(users.filter((u) => u.personnelRole === "TECNICO"));
        setAuditoresTI(users.filter((u) => u.personnelRole === "AUDITOR_TI"));
        setAuditoresInv(users.filter((u) => u.personnelRole === "AUDITOR_INVENTARIO"));
      });
  }, [isAdmin]);

  if (!store) return <div className="text-muted text-sm py-10 text-center">Cargando...</div>;

  const aplicables = store.checklist.filter((c) => !c.noAplica);
  const total = aplicables.length;
  const done = aplicables.filter((c) => c.completado).length;
  const pct = total ? Math.round((done / total) * 100) : 100;

  const categories = Array.from(
    new Map(store.checklist.map((c) => [c.itemDef.category.nombre, c.itemDef.category.orden])).entries()
  ).sort((a, b) => a[1] - b[1]);

  async function toggle(storeChecklistItemId: string) {
    await fetch("/api/checklist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeChecklistItemId }),
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
      <button onClick={() => router.push("/dashboard")} className="text-xs text-muted hover:text-text mb-4">
        &larr; Volver al dashboard
      </button>

      <div className="text-[11px] uppercase tracking-wide text-muted">
        {store.pais} · {store.region}
      </div>
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
          editable={isAdmin}
          onChange={(v) => assign("tecnicoId", v)}
        />
        <AssignField
          label="Auditor TI"
          value={store.auditorTI}
          options={auditoresTI}
          editable={isAdmin}
          onChange={(v) => assign("auditorTIId", v)}
        />
        <AssignField
          label="Auditor inventario"
          value={store.auditorInv}
          options={auditoresInv}
          editable={isAdmin}
          onChange={(v) => assign("auditorInvId", v)}
        />
        <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
          <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Tiempo</div>
          <div className="text-sm font-mono">
            {store.duracionRealMin != null ? `${store.duracionRealMin} min reales` : `Est. ${store.tiempoEstimadoMin} min`}
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

      {categories.map(([catName]) => {
        const items = store.checklist.filter((c) => c.itemDef.category.nombre === catName);
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
            {items.map((it) => (
              <div
                key={it.id}
                className={`flex items-center gap-2.5 py-1.5 px-1 rounded ${
                  it.noAplica ? "opacity-50" : "hover:bg-[#141A24]"
                }`}
              >
                <input
                  type="checkbox"
                  checked={it.completado}
                  disabled={it.noAplica}
                  onChange={() => toggle(it.id)}
                  className="w-[18px] h-[18px] rounded accent-teal disabled:cursor-not-allowed"
                />
                <span
                  onClick={() => !it.noAplica && toggle(it.id)}
                  className={`text-sm flex-1 ${!it.noAplica ? "cursor-pointer" : ""} ${
                    it.completado || it.noAplica ? "line-through text-muted" : ""
                  } ${it.noAplica ? "italic" : ""}`}
                >
                  {it.itemDef.nombre}
                </span>
                {it.completado && it.completadoPor && !it.noAplica && (
                  <span className="text-[10px] text-muted2">{it.completadoPor.name}</span>
                )}
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
                  N/A
                </button>
              </div>
            ))}
          </div>
        );
      })}

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
              {!inc.resuelta && (
                <button onClick={() => resolveIncident(inc.id)} className="text-teal text-[11px] hover:underline">
                  Marcar resuelta
                </button>
              )}
            </div>
            <div className="mt-1">{inc.descripcion}</div>
            {inc.createdBy && <div className="text-muted2 mt-1">— {inc.createdBy.name}</div>}
          </div>
        ))}
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
      </div>
    </div>
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
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : (
        <div className={`text-sm ${!value ? "text-muted2 italic" : ""}`}>{value?.name || "Sin asignar"}</div>
      )}
    </div>
  );
}

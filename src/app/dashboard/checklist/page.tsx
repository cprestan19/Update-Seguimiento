"use client";

import { useCallback, useEffect, useState } from "react";
import { useProjectContext } from "@/components/ProjectProvider";

type Tipo = "CHECK" | "DATO" | "NOTA";
type Item = { id: string; nombre: string; tipo: Tipo; region: string | null; tiendas: number };
type Seccion = { id: string; nombre: string; items: Item[] };
type Template = {
  totalTiendas: number;
  regiones: string[];
  secciones: Seccion[];
  importables: { id: string; name: string }[];
};

const TIPO_LABEL: Record<Tipo, string> = { CHECK: "Casilla", DATO: "Dato", NOTA: "Comentario" };
const NUEVA = "__nueva__";
const inputCls =
  "bg-panel2 border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue";

// Plantilla de checklist del proyecto: criterios que llevan todas las tiendas
// (o todas las de una región). Las tiendas nuevas los reciben automáticamente.
export default function ChecklistTemplatePage() {
  const { role } = useProjectContext();
  const [data, setData] = useState<Template | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/checklist/template");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (role !== "ADMIN") {
    return <div className="text-sm text-muted text-center py-10">Solo un administrador puede editar el checklist.</div>;
  }
  if (!data) return <div className="text-muted text-sm py-10 text-center">Cargando...</div>;

  async function rename(it: Item) {
    const nombre = prompt(`Nuevo nombre (se cambia en las ${it.tiendas} tiendas que lo tienen):`, it.nombre);
    if (!nombre || nombre.trim() === it.nombre) return;
    const res = await fetch(`/api/checklist/defs/${it.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    if (!res.ok) setMsg((await res.json().catch(() => ({}))).error || "No se pudo renombrar");
    load();
  }

  async function remove(it: Item) {
    if (!confirm(`¿Eliminar "${it.nombre}" de las ${it.tiendas} tiendas que lo tienen? Se pierde lo marcado.`)) return;
    const res = await fetch(`/api/checklist/defs/${it.id}`, { method: "DELETE" });
    if (!res.ok) setMsg((await res.json().catch(() => ({}))).error || "No se pudo eliminar");
    load();
  }

  const secciones = data.secciones.filter((s) => s.items.length > 0);

  return (
    <div className="max-w-3xl">
      <h1 className="font-display text-lg mb-1">Checklist del proyecto</h1>
      <p className="text-xs text-muted mb-6">
        Criterios que llevan todas las tiendas ({data.totalTiendas}) o las de una región. Las tiendas que agregues
        después los reciben automáticamente. Para un criterio de una sola tienda, agrégalo desde la tienda.
      </p>

      {msg && <p className="text-xs text-red mb-3">{msg}</p>}

      {secciones.length === 0 && (
        <p className="text-sm text-muted2 italic mb-6">Todavía no hay criterios de plantilla.</p>
      )}

      {secciones.map((s) => (
        <div key={s.id} className="mb-5">
          <div className="text-xs uppercase tracking-wide text-text font-semibold border-b border-border pb-2 mb-1">
            {s.nombre}
          </div>
          {s.items.map((it) => (
            <div key={it.id} className="flex items-center gap-2 py-1.5 px-1 rounded hover:bg-[#141A24]">
              <span className="text-sm flex-1">{it.nombre}</span>
              <span className="text-[10px] text-muted2">{TIPO_LABEL[it.tipo]}</span>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full border ${
                  it.region ? "text-blue border-blue/30" : "text-teal border-teal/30"
                }`}
              >
                {it.region ? `Región: ${it.region}` : "Todo el proyecto"}
              </span>
              <span className="text-[10px] text-muted2 w-16 text-right">{it.tiendas} tiendas</span>
              <button onClick={() => rename(it)} className="text-muted2 hover:text-blue text-sm px-1" title="Renombrar">
                ✎
              </button>
              <button onClick={() => remove(it)} className="text-muted2 hover:text-red text-sm px-1" title="Eliminar">
                ✕
              </button>
            </div>
          ))}
        </div>
      ))}

      <AddForm secciones={secciones.map((s) => s.nombre)} regiones={data.regiones} onDone={load} />
      {data.importables.length > 0 && <ImportForm proyectos={data.importables} onDone={load} />}
    </div>
  );
}

function AddForm({ secciones, regiones, onDone }: { secciones: string[]; regiones: string[]; onDone: () => void }) {
  const [nombres, setNombres] = useState("");
  const [seccion, setSeccion] = useState(secciones[secciones.length - 1] || NUEVA);
  const [nuevaSeccion, setNuevaSeccion] = useState("");
  const [tipo, setTipo] = useState<Tipo>("CHECK");
  const [alcance, setAlcance] = useState<string>("PROJECT");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (seccion !== NUEVA && !secciones.includes(seccion)) setSeccion(secciones[secciones.length - 1] || NUEVA);
  }, [secciones, seccion]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const seccionFinal = seccion === NUEVA ? nuevaSeccion.trim() : seccion;
    // Un criterio por línea, para cargar varios de una vez.
    const lista = nombres
      .split("\n")
      .map((n) => n.trim())
      .filter(Boolean);
    if (lista.length === 0 || !seccionFinal) {
      setError("Escribe al menos un criterio y la sección");
      return;
    }
    setSaving(true);
    for (const nombre of lista) {
      const res = await fetch("/api/checklist/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre,
          seccion: seccionFinal,
          tipo,
          alcance: alcance === "PROJECT" ? "PROJECT" : "REGION",
          region: alcance === "PROJECT" ? undefined : alcance,
        }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error || `No se pudo agregar "${nombre}"`);
        break;
      }
    }
    setSaving(false);
    setNombres("");
    if (seccion === NUEVA) {
      setSeccion(seccionFinal);
      setNuevaSeccion("");
    }
    onDone();
  }

  return (
    <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-4 mb-4">
      <h2 className="text-xs font-semibold font-display mb-2.5">+ Agregar criterios</h2>
      <textarea
        value={nombres}
        onChange={(e) => setNombres(e.target.value)}
        rows={3}
        placeholder={"Uno por línea, ej.\nActualización de Windows\nActualización de drivers"}
        className={`${inputCls} w-full mb-2`}
      />
      <div className="flex gap-2 flex-wrap">
        <select value={seccion} onChange={(e) => setSeccion(e.target.value)} className={inputCls}>
          {secciones.map((s) => (
            <option key={s} value={s}>
              Sección: {s}
            </option>
          ))}
          <option value={NUEVA}>Nueva sección…</option>
        </select>
        {seccion === NUEVA && (
          <input
            value={nuevaSeccion}
            onChange={(e) => setNuevaSeccion(e.target.value)}
            placeholder="Nombre de la sección"
            className={inputCls}
          />
        )}
        <select value={tipo} onChange={(e) => setTipo(e.target.value as Tipo)} className={inputCls}>
          <option value="CHECK">Casilla (check)</option>
          <option value="DATO">Dato (campo de texto)</option>
          <option value="NOTA">Comentario libre</option>
        </select>
        <select value={alcance} onChange={(e) => setAlcance(e.target.value)} className={inputCls}>
          <option value="PROJECT">Todas las tiendas del proyecto</option>
          {regiones.map((r) => (
            <option key={r} value={r}>
              Solo región: {r}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving}
          className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
        >
          {saving ? "Agregando..." : "Agregar"}
        </button>
      </div>
      {error && <p className="text-xs text-red mt-2">{error}</p>}
    </form>
  );
}

function ImportForm({ proyectos, onDone }: { proyectos: { id: string; name: string }[]; onDone: () => void }) {
  const [from, setFrom] = useState(proyectos[0]?.id || "");
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const nombre = proyectos.find((p) => p.id === from)?.name;
    if (!confirm(`¿Copiar los criterios de "${nombre}" a este proyecto? No se duplican los que ya existen.`)) return;
    setSaving(true);
    setResult(null);
    const res = await fetch("/api/checklist/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromProjectId: from }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    setResult(res.ok ? `Se copiaron ${data.copiados} criterios.` : data.error || "No se pudo importar");
    onDone();
  }

  return (
    <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-4">
      <h2 className="text-xs font-semibold font-display mb-1">Copiar criterios de otro proyecto</h2>
      <p className="text-[11px] text-muted mb-2.5">
        Reutiliza el checklist de una ventana de mantenimiento anterior. Se copian los criterios de proyecto y de
        región (no los propios de una tienda).
      </p>
      <div className="flex gap-2 flex-wrap">
        <select value={from} onChange={(e) => setFrom(e.target.value)} className={`${inputCls} flex-1 min-w-[200px]`}>
          {proyectos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={saving || !from}
          className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
        >
          {saving ? "Copiando..." : "Copiar"}
        </button>
      </div>
      {result && <p className="text-xs text-muted mt-2">{result}</p>}
    </form>
  );
}

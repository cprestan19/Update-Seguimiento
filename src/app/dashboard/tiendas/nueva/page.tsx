"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectContext } from "@/components/ProjectProvider";
import { REGIONES_DISPONIBLES } from "@/lib/regiones";

const OTRA = "__otra__";
const EMPTY_FORM = { pais: "", region: "", regionPersonalizada: "", nombre: "", horario: "" };

export default function NuevaCategoriaPage() {
  const { role } = useProjectContext();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (role !== "ADMIN") {
    return (
      <div className="text-sm text-muted text-center py-10">Solo un administrador puede agregar categorías.</div>
    );
  }

  const regionFinal = form.region === OTRA ? form.regionPersonalizada.trim() : form.region;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.pais.trim() || !regionFinal || !form.nombre.trim() || !form.horario.trim()) {
      setError("Completa país, región, nombre y horario");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pais: form.pais,
        region: regionFinal,
        tienda: form.nombre,
        horario: form.horario,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo crear la categoría");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="max-w-md">
      <button onClick={() => router.push("/dashboard")} className="text-xs text-muted hover:text-text mb-4">
        &larr; Volver al dashboard
      </button>
      <h1 className="font-display text-lg mb-1">Nueva categoría</h1>
      <p className="text-xs text-muted mb-6">
        Se le crea automáticamente el checklist del proyecto, en estado pendiente.
      </p>

      <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-5 space-y-3">
        <Field label="País">
          <input
            value={form.pais}
            onChange={(e) => setForm({ ...form, pais: e.target.value })}
            className="input"
            placeholder="Ej. Panamá"
          />
        </Field>
        <Field label="Región">
          <select
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="input"
          >
            <option value="">Selecciona una región</option>
            {REGIONES_DISPONIBLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
            <option value={OTRA}>Otra (especificar)</option>
          </select>
        </Field>
        {form.region === OTRA && (
          <Field label="Especifica la región">
            <input
              value={form.regionPersonalizada}
              onChange={(e) => setForm({ ...form, regionPersonalizada: e.target.value })}
              className="input"
              placeholder="Ej. Costa Rica"
            />
          </Field>
        )}
        <Field label="Nombre">
          <input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="input"
            placeholder="Ej. CK Albrook Mall"
          />
        </Field>
        <Field label="Horario">
          <input
            value={form.horario}
            onChange={(e) => setForm({ ...form, horario: e.target.value })}
            className="input"
            placeholder="Ej. 6:00AM"
          />
        </Field>
        {error && <p className="text-xs text-red">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "+ Crear categoría"}
        </button>
      </form>

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

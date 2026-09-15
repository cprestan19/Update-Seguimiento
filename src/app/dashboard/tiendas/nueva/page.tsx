"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectContext } from "@/components/ProjectProvider";

const EMPTY_FORM = { pais: "", region: "", tienda: "", horario: "" };

export default function NuevaTiendaPage() {
  const { role } = useProjectContext();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (role !== "ADMIN") {
    return (
      <div className="text-sm text-muted text-center py-10">Solo un administrador puede agregar tiendas.</div>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.pais.trim() || !form.region.trim() || !form.tienda.trim() || !form.horario.trim()) {
      setError("Completa país, región, tienda y horario");
      return;
    }
    setSaving(true);
    const res = await fetch("/api/stores", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo crear la tienda");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="max-w-md">
      <button onClick={() => router.push("/dashboard")} className="text-xs text-muted hover:text-text mb-4">
        &larr; Volver al dashboard
      </button>
      <h1 className="font-display text-lg mb-1">Nueva tienda</h1>
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
          <input
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
            className="input"
            placeholder="Ej. CK Panama"
          />
        </Field>
        <Field label="Tienda">
          <input
            value={form.tienda}
            onChange={(e) => setForm({ ...form, tienda: e.target.value })}
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
          {saving ? "Guardando..." : "+ Crear tienda"}
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

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useProjectContext } from "@/components/ProjectProvider";
import {
  TIPO_LABEL,
  AREA_LABEL,
  PRIORIDAD_LABEL,
  TIPOS_ORDENADOS,
  AREAS_ORDENADAS,
  PRIORIDADES_ORDENADAS,
} from "@/lib/requirementLabels";

type Person = { id: string; name: string; active: boolean };

type AreaField = { key: string; label: string; placeholder?: string };

const AREA_FIELDS: Record<string, AreaField[]> = {
  DESARROLLO: [
    { key: "aplicacion", label: "Aplicación" },
    { key: "modulo", label: "Módulo" },
    { key: "ambiente", label: "Ambiente" },
    { key: "repositorio", label: "Repositorio" },
    { key: "version", label: "Versión" },
    { key: "api", label: "API" },
    { key: "baseDatos", label: "Base de datos" },
    { key: "dependencias", label: "Dependencias" },
  ],
  IMPLEMENTACION: [
    { key: "sistema", label: "Sistema" },
    { key: "version", label: "Versión" },
    { key: "tiendasLocalidades", label: "Tiendas / localidades" },
    { key: "ambiente", label: "Ambiente" },
  ],
  INFRAESTRUCTURA: [
    { key: "servidor", label: "Servidor" },
    { key: "ambiente", label: "Ambiente" },
    { key: "sistemaOperativo", label: "Sistema operativo" },
    { key: "cpu", label: "CPU" },
    { key: "ram", label: "RAM" },
    { key: "storage", label: "Storage" },
    { key: "ip", label: "IP" },
    { key: "datacenter", label: "Datacenter" },
    { key: "cloudOnPremise", label: "Cloud / On-Premise" },
    { key: "backup", label: "Backup" },
    { key: "dependencias", label: "Dependencias" },
  ],
  REDES: [
    { key: "tipoRed", label: "Tipo de red" },
    { key: "ubicacion", label: "Ubicación" },
    { key: "pais", label: "País" },
    { key: "region", label: "Región" },
    { key: "ip", label: "IP" },
    { key: "subred", label: "Subred" },
    { key: "vlan", label: "VLAN" },
    { key: "equipoAfectado", label: "Equipo afectado" },
    { key: "fabricante", label: "Fabricante" },
    { key: "modelo", label: "Modelo" },
    { key: "serial", label: "Serial" },
    { key: "circuito", label: "Circuito" },
    { key: "proveedor", label: "Proveedor" },
    { key: "anchoBanda", label: "Ancho de banda" },
    { key: "ventanaMantenimiento", label: "Ventana de mantenimiento" },
    { key: "dependencias", label: "Dependencias" },
    { key: "impactoEsperado", label: "Impacto esperado" },
  ],
};

const EMPTY_FORM = {
  titulo: "",
  descripcion: "",
  objetivo: "",
  alcance: "",
  fueraDeAlcance: "",
  criteriosAceptacion: "",
  solicitadoPorNombre: "",
  departamentoSolicitante: "",
  gerenteDepartamento: "",
  liderProyectoId: "",
  responsableTecnicoId: "",
  observaciones: "",
  fechaSolicitud: new Date().toISOString().slice(0, 10),
  fechaEstimadaEntrega: "",
  tipo: "",
  area: "",
  prioridad: "",
};

export default function NuevoRequerimientoPage() {
  const { role } = useProjectContext();
  const router = useRouter();
  const [people, setPeople] = useState<Person[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [camposArea, setCamposArea] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: Person[]) => setPeople(users.filter((u) => u.active)));
  }, []);

  if (role === "MONITOR") {
    return <div className="text-sm text-muted text-center py-10">El rol Monitor solo puede ver, no crear requerimientos.</div>;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (
      !form.titulo.trim() ||
      !form.descripcion.trim() ||
      !form.solicitadoPorNombre.trim() ||
      !form.departamentoSolicitante.trim() ||
      !form.liderProyectoId ||
      !form.fechaSolicitud ||
      !form.fechaEstimadaEntrega ||
      !form.tipo ||
      !form.area ||
      !form.prioridad
    ) {
      setError("Completa los campos obligatorios: título, descripción, solicitado por, departamento, líder de proyecto, fechas, tipo, área y prioridad.");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/requerimientos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        responsableTecnicoId: form.responsableTecnicoId || null,
        camposArea: Object.keys(camposArea).length > 0 ? camposArea : undefined,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo crear el requerimiento");
      return;
    }
    const created = await res.json();
    router.push(`/dashboard/requerimientos/${created.id}`);
  }

  const areaFields = form.area ? AREA_FIELDS[form.area] || [] : [];

  return (
    <div className="max-w-2xl">
      <button onClick={() => router.push("/dashboard/requerimientos")} className="text-xs text-muted hover:text-text mb-4">
        &larr; Volver a requerimientos
      </button>
      <h1 className="font-display text-lg mb-1">Nuevo requerimiento</h1>
      <p className="text-xs text-muted mb-6">Se le asignará automáticamente un número (REQ-{new Date().getFullYear()}-00001, …).</p>

      <form onSubmit={submit} className="space-y-4">
        <Section title="Identificación">
          <Field label="Título">
            <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className="input" placeholder="Ej. Actualización de RetailApp" />
          </Field>
          <Field label="Descripción detallada (sin límite de texto, explica todo lo necesario)">
            <textarea
              value={form.descripcion}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              className="input input-lg"
              rows={10}
            />
          </Field>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Objetivo (opcional)">
              <input value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} className="input" />
            </Field>
            <Field label="Alcance (opcional)">
              <input value={form.alcance} onChange={(e) => setForm({ ...form, alcance: e.target.value })} className="input" />
            </Field>
            <Field label="Fuera de alcance (opcional)">
              <input value={form.fueraDeAlcance} onChange={(e) => setForm({ ...form, fueraDeAlcance: e.target.value })} className="input" />
            </Field>
            <Field label="Criterios de aceptación (opcional)">
              <input value={form.criteriosAceptacion} onChange={(e) => setForm({ ...form, criteriosAceptacion: e.target.value })} className="input" />
            </Field>
          </div>
        </Section>

        <Section title="Solicitud">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Solicitado por">
              <input value={form.solicitadoPorNombre} onChange={(e) => setForm({ ...form, solicitadoPorNombre: e.target.value })} className="input" />
            </Field>
            <Field label="Departamento solicitante">
              <input value={form.departamentoSolicitante} onChange={(e) => setForm({ ...form, departamentoSolicitante: e.target.value })} className="input" placeholder="Ej. Operaciones" />
            </Field>
            <Field label="Gerente del departamento (opcional)">
              <input value={form.gerenteDepartamento} onChange={(e) => setForm({ ...form, gerenteDepartamento: e.target.value })} className="input" />
            </Field>
            <Field label="Líder de proyecto">
              <select value={form.liderProyectoId} onChange={(e) => setForm({ ...form, liderProyectoId: e.target.value })} className="input">
                <option value="">Selecciona...</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Responsable técnico (opcional)">
              <select value={form.responsableTecnicoId} onChange={(e) => setForm({ ...form, responsableTecnicoId: e.target.value })} className="input">
                <option value="">Sin asignar</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Observaciones (opcional)">
            <input value={form.observaciones} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className="input" />
          </Field>
        </Section>

        <Section title="Clasificación">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Tipo">
              <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="input">
                <option value="">Selecciona...</option>
                {TIPOS_ORDENADOS.map((k) => (
                  <option key={k} value={k}>
                    {TIPO_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Área">
              <select value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} className="input">
                <option value="">Selecciona...</option>
                {AREAS_ORDENADAS.map((k) => (
                  <option key={k} value={k}>
                    {AREA_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Prioridad">
              <select value={form.prioridad} onChange={(e) => setForm({ ...form, prioridad: e.target.value })} className="input">
                <option value="">Selecciona...</option>
                {PRIORIDADES_ORDENADAS.map((k) => (
                  <option key={k} value={k}>
                    {PRIORIDAD_LABEL[k]}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          {areaFields.length > 0 && (
            <div className="border-t border-border pt-3 mt-3">
              <div className="text-[10px] uppercase tracking-wide text-muted mb-2.5">
                Detalles de {AREA_LABEL[form.area]} (opcional)
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {areaFields.map((f) => (
                  <Field key={f.key} label={f.label}>
                    <input
                      value={camposArea[f.key] || ""}
                      onChange={(e) => setCamposArea({ ...camposArea, [f.key]: e.target.value })}
                      className="input"
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}
        </Section>

        <Section title="Fechas">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Fecha de solicitud">
              <input type="date" value={form.fechaSolicitud} onChange={(e) => setForm({ ...form, fechaSolicitud: e.target.value })} className="input [color-scheme:dark]" />
            </Field>
            <Field label="Fecha estimada de entrega">
              <input type="date" value={form.fechaEstimadaEntrega} onChange={(e) => setForm({ ...form, fechaEstimadaEntrega: e.target.value })} className="input [color-scheme:dark]" />
            </Field>
          </div>
        </Section>

        {error && <p className="text-xs text-red">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20 disabled:opacity-50"
        >
          {saving ? "Creando..." : "+ Crear requerimiento"}
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
        /* Texto libre y extenso: interlineado generoso, se puede agrandar
           arrastrando la esquina. Sin text-align:justify a propósito — en
           texto de ancho variable "justificar" deja espacios en blanco
           irregulares entre palabras y empeora la lectura. */
        .input-lg {
          line-height: 1.6;
          min-height: 220px;
          resize: vertical;
        }
        .input:focus {
          outline: 2px solid #3b9eff;
        }
      `}</style>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-border rounded-2xl p-5 space-y-3">
      <h2 className="text-sm font-semibold font-display">{title}</h2>
      {children}
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useProjectContext } from "@/components/ProjectProvider";
import {
  ESTADO_LABEL,
  ESTADO_BADGE,
  PRIORIDAD_LABEL,
  PRIORIDAD_BADGE,
  TIPO_LABEL,
  AREA_LABEL,
  IMPACTO_LABEL,
  RIESGO_LABEL,
  ALCANCE_AFECTADOS_LABEL,
  ACTIVITY_TIPO_LABEL,
  ESTADOS_ORDENADOS,
  PRIORIDADES_ORDENADAS,
  IMPACTOS_ORDENADOS,
  RIESGOS_ORDENADOS,
  ALCANCES_ORDENADOS,
  SLA_DOT,
  SLA_TEXT,
} from "@/lib/requirementLabels";

type Person = { id: string; name: string; active?: boolean } | null;

type Activity = {
  id: string;
  tipo: string;
  descripcion: string;
  metadata: Record<string, unknown> | null;
  user: { id: string; name: string } | null;
  createdAt: string;
};

type RequirementDetail = {
  id: string;
  numero: string;
  titulo: string;
  descripcion: string;
  objetivo: string | null;
  alcance: string | null;
  fueraDeAlcance: string | null;
  criteriosAceptacion: string | null;
  solicitadoPorNombre: string;
  departamentoSolicitante: string;
  gerenteDepartamento: string | null;
  liderProyecto: Person;
  responsableTecnico: Person;
  responsableDependencia: Person;
  observaciones: string | null;
  fechaSolicitud: string;
  fechaEstimadaEntrega: string;
  fechaRealEntrega: string | null;
  tipo: string;
  area: string;
  prioridad: string;
  estado: string;
  impacto: string;
  alcanceAfectados: string | null;
  alcanceAfectadosDetalle: string | null;
  bloqueado: boolean;
  motivoBloqueo: string | null;
  dependenciaExterna: boolean;
  dependenciaInterna: boolean;
  riesgo: string | null;
  motivoRiesgo: string | null;
  camposArea: Record<string, string> | null;
  implementacion: Record<string, string> | null;
  activities: Activity[];
  sla: { color: string; label: string; vencido: boolean; proximoAVencer: boolean };
};

function formatFecha(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-PA", { day: "2-digit", month: "short", year: "numeric" });
}

function toDateInput(iso: string | null): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-PA", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const IMPLEMENTACION_FIELDS: { key: string; label: string }[] = [
  { key: "ambiente", label: "Ambiente" },
  { key: "fechaImplementacion", label: "Fecha de implementación" },
  { key: "ventanaMantenimiento", label: "Ventana de mantenimiento" },
  { key: "resultado", label: "Resultado" },
  { key: "evidencia", label: "Evidencia" },
  { key: "planRollback", label: "Plan de rollback / contingencia" },
  { key: "dependencias", label: "Dependencias" },
  { key: "impactoEsperado", label: "Impacto esperado" },
];

export default function RequerimientoDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { role } = useProjectContext();
  const isMonitor = role === "MONITOR";
  const isAdmin = role === "ADMIN";

  const [req, setReq] = useState<RequirementDetail | null>(null);
  const [people, setPeople] = useState<{ id: string; name: string; active: boolean }[]>([]);
  const [newComment, setNewComment] = useState("");
  const [implementacionOpen, setImplementacionOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/requerimientos/${id}`);
    if (res.ok) setReq(await res.json());
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useRealtimeRefresh("requerimientos", load);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: { id: string; name: string; active: boolean }[]) => setPeople(users));
  }, []);

  if (!req) return <div className="text-muted text-sm py-10 text-center">Cargando...</div>;

  const activePeople = people.filter((p) => p.active);

  async function patch(body: Record<string, unknown>) {
    setSaveError(null);
    const res = await fetch(`/api/requerimientos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || "No se pudo guardar el cambio");
      return false;
    }
    load();
    return true;
  }

  async function onEstadoChange(nuevo: string) {
    await patch({ estado: nuevo });
  }

  async function onPrioridadChange(nuevo: string) {
    await patch({ prioridad: nuevo });
  }

  async function onFechaEstimadaChange(value: string) {
    if (!value || !req) return;
    const iso = new Date(value).toISOString();
    if (iso.slice(0, 10) === req.fechaEstimadaEntrega.slice(0, 10)) return;
    const motivo = window.prompt("¿Cuál es el motivo del cambio de fecha estimada de entrega?");
    if (!motivo || !motivo.trim()) {
      setSaveError("El cambio de fecha se canceló: se necesita un motivo.");
      return;
    }
    await patch({ fechaEstimadaEntrega: iso, motivoCambioFecha: motivo.trim() });
  }

  async function onFechaRealChange(value: string) {
    await patch({ fechaRealEntrega: value ? new Date(value).toISOString() : null });
  }

  async function addComment() {
    if (!newComment.trim()) return;
    const res = await fetch(`/api/requerimientos/${id}/actividades`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descripcion: newComment }),
    });
    if (res.ok) {
      setNewComment("");
      load();
    }
  }

  async function deleteRequirement() {
    if (!req) return;
    if (!confirm(`¿Eliminar "${req.numero} — ${req.titulo}"? Se conserva en el historial pero deja de aparecer en la lista.`)) return;
    setDeleting(true);
    const res = await fetch(`/api/requerimientos/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json();
      setSaveError(data.error || "No se pudo eliminar el requerimiento");
      setDeleting(false);
      return;
    }
    router.push("/dashboard/requerimientos");
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/dashboard/requerimientos")} className="text-xs text-muted hover:text-text">
          &larr; Volver a requerimientos
        </button>
        {isAdmin && (
          <button
            onClick={deleteRequirement}
            disabled={deleting}
            className="text-xs text-red hover:underline disabled:opacity-50"
          >
            {deleting ? "Eliminando..." : "Eliminar requerimiento"}
          </button>
        )}
      </div>
      {saveError && <p className="text-xs text-red mb-3">{saveError}</p>}

      <div className="text-[11px] uppercase tracking-wide text-muted font-mono">{req.numero}</div>
      <h1 className="font-display text-xl mt-1">{req.titulo}</h1>
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${ESTADO_BADGE[req.estado]}`}>
          {ESTADO_LABEL[req.estado]}
        </span>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold ${PRIORIDAD_BADGE[req.prioridad]}`}>
          {PRIORIDAD_LABEL[req.prioridad]}
        </span>
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className={`w-1.5 h-1.5 rounded-full ${SLA_DOT[req.sla.color]}`} />
          <span className={SLA_TEXT[req.sla.color]}>{req.sla.label}</span>
        </span>
        {req.bloqueado && (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-redDim text-red">
            Bloqueado
          </span>
        )}
      </div>

      {/* ---- Resumen / clasificación ---- */}
      <Card title="Información general">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <ReadField label="Tipo" value={TIPO_LABEL[req.tipo]} />
          <ReadField label="Área" value={AREA_LABEL[req.area]} />
          <EditableSelect
            label="Estado"
            value={req.estado}
            editable={!isMonitor}
            options={ESTADOS_ORDENADOS.map((k) => ({ value: k, label: ESTADO_LABEL[k] }))}
            onChange={onEstadoChange}
          />
          <EditableSelect
            label="Prioridad"
            value={req.prioridad}
            editable={!isMonitor}
            options={PRIORIDADES_ORDENADAS.map((k) => ({ value: k, label: PRIORIDAD_LABEL[k] }))}
            onChange={onPrioridadChange}
          />
          <EditableSelect
            label="Impacto"
            value={req.impacto}
            editable={!isMonitor}
            options={IMPACTOS_ORDENADOS.map((k) => ({ value: k, label: IMPACTO_LABEL[k] }))}
            onChange={(v) => patch({ impacto: v })}
          />
          <EditableSelect
            label="Riesgo"
            value={req.riesgo || ""}
            editable={!isMonitor}
            options={[{ value: "", label: "Sin definir" }, ...RIESGOS_ORDENADOS.map((k) => ({ value: k, label: RIESGO_LABEL[k] }))]}
            onChange={(v) => patch({ riesgo: v || null })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
          <EditableSelect
            label="Usuarios afectados"
            value={req.alcanceAfectados || ""}
            editable={!isMonitor}
            options={[{ value: "", label: "Sin definir" }, ...ALCANCES_ORDENADOS.map((k) => ({ value: k, label: ALCANCE_AFECTADOS_LABEL[k] }))]}
            onChange={(v) => patch({ alcanceAfectados: v || null })}
          />
          <EditableText
            label="Detalle de afectados"
            value={req.alcanceAfectadosDetalle || ""}
            editable={!isMonitor}
            onSave={(v) => patch({ alcanceAfectadosDetalle: v })}
          />
        </div>
      </Card>

      {/* ---- Dependencias / bloqueo ---- */}
      <Card title="Dependencias y bloqueo">
        <div className="flex flex-wrap gap-4 mb-2.5">
          <ToggleField label="Bloqueado" checked={req.bloqueado} editable={!isMonitor} onChange={(v) => patch({ bloqueado: v })} />
          <ToggleField
            label="Dependencia externa"
            checked={req.dependenciaExterna}
            editable={!isMonitor}
            onChange={(v) => patch({ dependenciaExterna: v })}
          />
          <ToggleField
            label="Dependencia interna"
            checked={req.dependenciaInterna}
            editable={!isMonitor}
            onChange={(v) => patch({ dependenciaInterna: v })}
          />
        </div>
        {(req.bloqueado || req.motivoBloqueo) && (
          <EditableText label="Motivo del bloqueo" value={req.motivoBloqueo || ""} editable={!isMonitor} onSave={(v) => patch({ motivoBloqueo: v })} />
        )}
        {req.riesgo && (
          <EditableText label="Motivo del riesgo" value={req.motivoRiesgo || ""} editable={!isMonitor} onSave={(v) => patch({ motivoRiesgo: v })} />
        )}
      </Card>

      {/* ---- Solicitud ---- */}
      <Card title="Solicitud">
        <div className="grid grid-cols-2 gap-2.5">
          <EditableText label="Solicitado por" value={req.solicitadoPorNombre} editable={!isMonitor} onSave={(v) => patch({ solicitadoPorNombre: v })} />
          <EditableText
            label="Departamento solicitante"
            value={req.departamentoSolicitante}
            editable={!isMonitor}
            onSave={(v) => patch({ departamentoSolicitante: v })}
          />
          <EditableText
            label="Gerente del departamento"
            value={req.gerenteDepartamento || ""}
            editable={!isMonitor}
            onSave={(v) => patch({ gerenteDepartamento: v })}
          />
          <PersonField
            label="Líder de proyecto"
            person={req.liderProyecto}
            options={activePeople}
            editable={!isMonitor}
            onChange={(v) => patch({ liderProyectoId: v })}
          />
          <PersonField
            label="Responsable técnico"
            person={req.responsableTecnico}
            options={activePeople}
            editable={!isMonitor}
            onChange={(v) => patch({ responsableTecnicoId: v || null })}
            allowEmpty
          />
        </div>
        <EditableText label="Observaciones" value={req.observaciones || ""} editable={!isMonitor} onSave={(v) => patch({ observaciones: v })} />
      </Card>

      {/* ---- Fechas ---- */}
      <Card title="Fechas y SLA">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
          <ReadField label="Solicitud" value={formatFecha(req.fechaSolicitud)} />
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Fecha estimada</div>
            {isMonitor ? (
              <div className="text-sm font-mono">{formatFecha(req.fechaEstimadaEntrega)}</div>
            ) : (
              <input
                type="date"
                defaultValue={toDateInput(req.fechaEstimadaEntrega)}
                onBlur={(e) => onFechaEstimadaChange(e.target.value)}
                className="w-full bg-transparent text-sm font-mono focus:outline-none [color-scheme:dark]"
              />
            )}
          </div>
          <div className="bg-panel border border-border rounded-lg px-2.5 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted mb-1">Fecha real de entrega</div>
            {isMonitor ? (
              <div className="text-sm font-mono">{formatFecha(req.fechaRealEntrega)}</div>
            ) : (
              <input
                type="date"
                defaultValue={toDateInput(req.fechaRealEntrega)}
                onBlur={(e) => onFechaRealChange(e.target.value)}
                className="w-full bg-transparent text-sm font-mono focus:outline-none [color-scheme:dark]"
              />
            )}
          </div>
        </div>
      </Card>

      {/* ---- Descripción ---- */}
      <Card title="Descripción">
        <EditableTextarea label="Descripción" value={req.descripcion} editable={!isMonitor} onSave={(v) => patch({ descripcion: v })} required />
        <EditableTextarea label="Objetivo" value={req.objetivo || ""} editable={!isMonitor} onSave={(v) => patch({ objetivo: v })} />
        <EditableTextarea label="Alcance" value={req.alcance || ""} editable={!isMonitor} onSave={(v) => patch({ alcance: v })} />
        <EditableTextarea label="Fuera de alcance" value={req.fueraDeAlcance || ""} editable={!isMonitor} onSave={(v) => patch({ fueraDeAlcance: v })} />
        <EditableTextarea
          label="Criterios de aceptación"
          value={req.criteriosAceptacion || ""}
          editable={!isMonitor}
          onSave={(v) => patch({ criteriosAceptacion: v })}
        />
      </Card>

      {req.camposArea && Object.keys(req.camposArea).length > 0 && (
        <Card title={`Detalles de ${AREA_LABEL[req.area]}`}>
          <div className="grid grid-cols-2 gap-2.5">
            {Object.entries(req.camposArea).map(([k, v]) => (
              <ReadField key={k} label={k} value={String(v) || "—"} />
            ))}
          </div>
        </Card>
      )}

      {/* ---- Implementación (colapsable) ---- */}
      <div className="bg-panel border border-border rounded-2xl p-5 mb-4">
        <button
          type="button"
          onClick={() => setImplementacionOpen((v) => !v)}
          className="w-full flex items-center justify-between text-left"
        >
          <h2 className="text-sm font-semibold font-display">Implementación</h2>
          <span className={`text-muted text-xs transition-transform ${implementacionOpen ? "rotate-90" : ""}`}>▶</span>
        </button>
        {implementacionOpen && (
          <div className="grid grid-cols-2 gap-2.5 mt-3">
            {IMPLEMENTACION_FIELDS.map((f) => (
              <EditableText
                key={f.key}
                label={f.label}
                value={req.implementacion?.[f.key] || ""}
                editable={!isMonitor}
                onSave={(v) => patch({ implementacion: { ...(req.implementacion || {}), [f.key]: v } })}
              />
            ))}
          </div>
        )}
      </div>

      {/* ---- Documentación (diferido) ---- */}
      <Card title="Documentación">
        <p className="text-xs text-muted2 italic">
          Próximamente — la carga de documentos se habilitará en una siguiente entrega.
        </p>
      </Card>

      {/* ---- Seguimiento / historial ---- */}
      <div className="mt-6 border-t border-border pt-4">
        <h3 className="text-xs uppercase tracking-wide text-muted mb-2.5">Seguimiento e historial</h3>
        {req.activities.length === 0 && <p className="text-xs text-muted2 italic">Sin actividad registrada.</p>}
        {req.activities.map((a) => (
          <div
            key={a.id}
            className={`rounded-lg p-3 mb-2 text-xs ${
              a.tipo === "COMENTARIO" ? "bg-panel2 border border-border" : "bg-panel border border-border"
            }`}
          >
            <div className="flex justify-between items-start gap-2">
              <span className={`font-semibold uppercase text-[11px] ${a.tipo === "COMENTARIO" ? "text-blue" : "text-muted"}`}>
                {ACTIVITY_TIPO_LABEL[a.tipo] || a.tipo}
              </span>
              <span className="text-muted2 text-[10px] shrink-0">{formatFechaHora(a.createdAt)}</span>
            </div>
            <div className="mt-1">{a.descripcion}</div>
            {a.user && <div className="text-muted2 mt-1">— {a.user.name}</div>}
          </div>
        ))}
        {!isMonitor && (
          <div className="flex gap-2 mt-3">
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Agregar un comentario o actividad..."
              className="flex-1 bg-panel2 border border-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue"
            />
            <button onClick={addComment} className="bg-blueDim text-blue border border-blue/30 rounded-lg px-3 text-xs font-semibold">
              Comentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-panel border border-border rounded-2xl p-5 mb-4 space-y-2.5">
      <h2 className="text-sm font-semibold font-display mb-1">{title}</h2>
      {children}
    </div>
  );
}

function ReadField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}

function EditableSelect({
  label,
  value,
  options,
  editable,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  editable: boolean;
  onChange: (v: string) => void;
}) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      {editable ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm focus:outline-none">
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="text-sm">{options.find((o) => o.value === value)?.label || "—"}</div>
      )}
    </div>
  );
}

function EditableText({
  label,
  value,
  editable,
  onSave,
}: {
  label: string;
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
}) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      {editable ? (
        <input
          defaultValue={value}
          onBlur={(e) => {
            if (e.target.value !== value) onSave(e.target.value);
          }}
          className="w-full bg-transparent text-sm focus:outline-none"
        />
      ) : (
        <div className={`text-sm ${!value ? "text-muted2 italic" : ""}`}>{value || "Sin registrar"}</div>
      )}
    </div>
  );
}

function EditableTextarea({
  label,
  value,
  editable,
  onSave,
  required,
}: {
  label: string;
  value: string;
  editable: boolean;
  onSave: (v: string) => void;
  required?: boolean;
}) {
  return (
    <div className="bg-panel2 border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      {editable ? (
        <textarea
          defaultValue={value}
          rows={2}
          onBlur={(e) => {
            if (required && !e.target.value.trim()) return;
            if (e.target.value !== value) onSave(e.target.value);
          }}
          className="w-full bg-transparent text-sm focus:outline-none resize-y"
        />
      ) : (
        <div className={`text-sm whitespace-pre-wrap ${!value ? "text-muted2 italic" : ""}`}>{value || "Sin registrar"}</div>
      )}
    </div>
  );
}

function ToggleField({
  label,
  checked,
  editable,
  onChange,
}: {
  label: string;
  checked: boolean;
  editable: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={!editable}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded accent-amber disabled:cursor-not-allowed"
      />
      {label}
    </label>
  );
}

function PersonField({
  label,
  person,
  options,
  editable,
  onChange,
  allowEmpty,
}: {
  label: string;
  person: { id: string; name: string } | null;
  options: { id: string; name: string }[];
  editable: boolean;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const deBaja = person && !options.some((o) => o.id === person.id) ? person : null;
  return (
    <div className="bg-panel2 border border-border rounded-lg px-2.5 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted mb-1">{label}</div>
      {editable ? (
        <select value={person?.id || ""} onChange={(e) => onChange(e.target.value)} className="w-full bg-transparent text-sm focus:outline-none">
          {allowEmpty && <option value="">Sin asignar</option>}
          {!allowEmpty && !person && <option value="">Selecciona...</option>}
          {deBaja && <option value={deBaja.id}>{deBaja.name} (de baja)</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      ) : (
        <div className={`text-sm ${!person ? "text-muted2 italic" : ""}`}>
          {person ? `${person.name}${deBaja ? " (de baja)" : ""}` : "Sin asignar"}
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeRefresh } from "@/hooks/useRealtimeRefresh";
import { useProjectContext } from "@/components/ProjectProvider";

type PersonRow = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "USER" | "MONITOR";
  personnelRole: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | "INFRAESTRUCTURA" | null;
  pais: string | null;
  active: boolean;
  online: boolean;
  tiendasAsignadas: number;
};

type SearchResult = { id: string; name: string; username: string };

const ROLE_LABEL: Record<string, string> = {
  TECNICO: "Técnico",
  AUDITOR_TI: "Auditor TI",
  AUDITOR_INVENTARIO: "Auditor Inventario",
  COORDINADOR: "Coordinador",
  INFRAESTRUCTURA: "Infraestructura",
};

const EMPTY_FORM = {
  name: "",
  username: "",
  password: "",
  role: "USER",
  personnelRole: "TECNICO",
  pais: "",
};

type ShareInfo = { name: string; username: string; password: string };

function buildWhatsAppLink(info: ShareInfo) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/login` : "";
  const mensaje = `Hola ${info.name}, estos son tus accesos a ToolsIT Control Center:\n\nUsuario: ${info.username}\nContraseña: ${info.password}\n\nIngresa aquí: ${url}`;
  return `https://wa.me/?text=${encodeURIComponent(mensaje)}`;
}

export default function EquipoPage() {
  const { role } = useProjectContext();
  const router = useRouter();
  const [users, setUsers] = useState<PersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [tab, setTab] = useState<"nueva" | "existente">("nueva");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [attachForm, setAttachForm] = useState({ role: "USER", personnelRole: "TECNICO", pais: "" });
  const [attaching, setAttaching] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [showOnlineList, setShowOnlineList] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    if (role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    load();
  }, [role, load, router]);

  useEffect(() => {
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useRealtimeRefresh("users", load);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`);
      if (res.ok) setResults(await res.json());
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo crear el usuario");
      return;
    }
    setShareInfo({ name: form.name, username: form.username, password: form.password });
    setForm(EMPTY_FORM);
    load();
  }

  async function attach(person: SearchResult) {
    setAttaching(person.id);
    setError(null);
    const res = await fetch("/api/users/attach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: person.id, ...attachForm }),
    });
    setAttaching(null);
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo agregar a esa persona");
      return;
    }
    setQuery("");
    setResults([]);
    load();
  }

  function startEdit(u: PersonRow) {
    setEditingId(u.id);
    setEditError(null);
    setEditForm({
      name: u.name,
      username: u.username,
      password: "",
      role: u.role,
      personnelRole: u.personnelRole || "TECNICO",
      pais: u.pais || "",
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditError(null);
  }

  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    const body: Record<string, unknown> = {
      name: editForm.name,
      username: editForm.username,
      role: editForm.role,
      personnelRole: editForm.personnelRole,
      pais: editForm.pais,
    };
    if (editForm.password) body.password = editForm.password;

    const res = await fetch(`/api/users/${editingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json();
      setEditError(data.error || "No se pudo guardar el cambio");
      return;
    }
    if (editForm.password) {
      setShareInfo({ name: editForm.name, username: editForm.username, password: editForm.password });
    }
    setEditingId(null);
    load();
  }

  async function quitarDelProyecto(id: string) {
    if (!confirm("¿Quitar a esta persona de este proyecto? Se desasignará de las tiendas del proyecto (sigue existiendo su cuenta y su acceso a otros proyectos).")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  async function toggleBaja(u: PersonRow) {
    const mensaje = u.active
      ? `¿Dar de baja a ${u.name}? No podrá volver a entrar, pero se conservan sus tiendas asignadas y todo su historial.`
      : `¿Reactivar a ${u.name}? Volverá a poder entrar con su usuario y contraseña.`;
    if (!confirm(mensaje)) return;
    setError(null);
    const res = await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "No se pudo cambiar el estado de esa persona");
      return;
    }
    load();
  }

  const onlineUsers = users.filter((u) => u.online);

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
        <h1 className="font-display text-lg">Equipo del proyecto</h1>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowOnlineList(true)}
            onMouseLeave={() => setShowOnlineList(false)}
            onClick={() => setShowOnlineList((v) => !v)}
            className="text-xs text-muted flex items-center gap-1.5"
          >
            <span className="w-2 h-2 rounded-full bg-teal" />
            {onlineUsers.length} conectado{onlineUsers.length === 1 ? "" : "s"} ahora
          </button>
          {showOnlineList && onlineUsers.length > 0 && (
            <div className="absolute right-0 top-full mt-2 z-10 bg-panel2 border border-border rounded-lg p-2.5 min-w-[170px] shadow-lg">
              <div className="text-[10px] uppercase tracking-wide text-muted mb-1.5">En línea</div>
              <ul className="space-y-1">
                {onlineUsers.map((u) => (
                  <li key={u.id} className="text-xs text-text flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" />
                    {u.name}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <p className="text-xs text-muted mb-6">
        Da de alta a técnicos, auditores TI y auditores de inventario de este proyecto, o agrega a alguien que ya
        tiene cuenta en otro proyecto.
      </p>

      <div className="flex gap-1 mb-3">
        <button
          type="button"
          onClick={() => setTab("nueva")}
          className={`text-xs px-3 py-1.5 rounded-lg transition ${tab === "nueva" ? "bg-panel2 text-text" : "text-muted hover:text-text"}`}
        >
          Nueva persona
        </button>
        <button
          type="button"
          onClick={() => setTab("existente")}
          className={`text-xs px-3 py-1.5 rounded-lg transition ${tab === "existente" ? "bg-panel2 text-text" : "text-muted hover:text-text"}`}
        >
          Persona existente
        </button>
      </div>

      {tab === "nueva" ? (
        <form onSubmit={submit} className="bg-panel border border-border rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <Field label="Nombre completo">
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Usuario (login)">
              <input
                required
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Contraseña temporal">
              <input
                required
                type="password"
                minLength={8}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Rol de acceso">
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="input"
              >
                <option value="USER">Usuario</option>
                <option value="ADMIN">Administrador</option>
                <option value="MONITOR">Monitor (solo ver)</option>
              </select>
            </Field>
            <Field label="Rol funcional">
              <select
                value={form.personnelRole}
                onChange={(e) => setForm({ ...form, personnelRole: e.target.value })}
                className="input"
              >
                <option value="TECNICO">Técnico</option>
                <option value="AUDITOR_TI">Auditor TI</option>
                <option value="AUDITOR_INVENTARIO">Auditor Inventario</option>
                <option value="COORDINADOR">Coordinador</option>
                <option value="INFRAESTRUCTURA">Infraestructura</option>
              </select>
            </Field>
            <Field label="País (opcional)">
              <input
                value={form.pais}
                onChange={(e) => setForm({ ...form, pais: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          {error && <p className="text-xs text-red mb-2">{error}</p>}
          <button
            type="submit"
            className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20"
          >
            + Agregar al equipo
          </button>
        </form>
      ) : (
        <div className="bg-panel border border-border rounded-2xl p-5 mb-6">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
            <Field label="Rol de acceso para este proyecto">
              <select
                value={attachForm.role}
                onChange={(e) => setAttachForm({ ...attachForm, role: e.target.value })}
                className="input"
              >
                <option value="USER">Usuario</option>
                <option value="ADMIN">Administrador</option>
                <option value="MONITOR">Monitor (solo ver)</option>
              </select>
            </Field>
            <Field label="Rol funcional">
              <select
                value={attachForm.personnelRole}
                onChange={(e) => setAttachForm({ ...attachForm, personnelRole: e.target.value })}
                className="input"
              >
                <option value="TECNICO">Técnico</option>
                <option value="AUDITOR_TI">Auditor TI</option>
                <option value="AUDITOR_INVENTARIO">Auditor Inventario</option>
                <option value="COORDINADOR">Coordinador</option>
                <option value="INFRAESTRUCTURA">Infraestructura</option>
              </select>
            </Field>
            <Field label="País (opcional)">
              <input
                value={attachForm.pais}
                onChange={(e) => setAttachForm({ ...attachForm, pais: e.target.value })}
                className="input"
              />
            </Field>
          </div>
          <Field label="Buscar por nombre o usuario">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe al menos 2 letras..."
              className="input"
            />
          </Field>
          {error && <p className="text-xs text-red mt-2">{error}</p>}
          {results.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {results.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 bg-panel2 border border-border rounded-lg px-3 py-2"
                >
                  <div className="text-sm">
                    {p.name} <span className="text-muted text-xs">@{p.username}</span>
                  </div>
                  <button
                    onClick={() => attach(p)}
                    disabled={attaching === p.id}
                    className="text-xs text-teal hover:underline disabled:opacity-50"
                  >
                    {attaching === p.id ? "Agregando..." : "Agregar a este proyecto"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-muted mt-3">Sin resultados (o ya pertenece a este proyecto).</p>
          )}
        </div>
      )}

      {shareInfo && (
        <div className="bg-tealDim border border-teal/30 rounded-xl p-3.5 mb-6 flex items-center justify-between flex-wrap gap-3">
          <div className="text-sm">
            <span className="font-semibold text-teal">Accesos listos para {shareInfo.name}.</span>{" "}
            <span className="text-muted">
              Usuario <span className="font-mono text-text">{shareInfo.username}</span> · Contraseña{" "}
              <span className="font-mono text-text">{shareInfo.password}</span>
            </span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <a
              href={buildWhatsAppLink(shareInfo)}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-[#128C7E] text-white rounded-lg px-3.5 py-1.5 text-xs font-semibold hover:opacity-90"
            >
              Enviar por WhatsApp
            </a>
            <button onClick={() => setShareInfo(null)} className="text-muted hover:text-text text-xs">
              Cerrar
            </button>
          </div>
        </div>
      )}

      <div className="bg-panel border border-border rounded-2xl divide-y divide-border overflow-hidden">
        {users.map((u) =>
          editingId === u.id ? (
            <form
              key={u.id}
              onSubmit={submitEdit}
              className="bg-panel2 border-y border-blue/40 -my-px p-3.5"
            >
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5 mb-2.5">
                <Field label="Nombre completo">
                  <input
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Usuario (login)">
                  <input
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Nueva contraseña (opcional)">
                  <input
                    type="password"
                    minLength={8}
                    placeholder="Dejar en blanco para no cambiar"
                    value={editForm.password}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    className="input"
                  />
                </Field>
                <Field label="Rol de acceso">
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    className="input"
                  >
                    <option value="USER">Usuario</option>
                    <option value="ADMIN">Administrador</option>
                    <option value="MONITOR">Monitor (solo ver)</option>
                  </select>
                </Field>
                <Field label="Rol funcional">
                  <select
                    value={editForm.personnelRole}
                    onChange={(e) => setEditForm({ ...editForm, personnelRole: e.target.value })}
                    className="input"
                  >
                    <option value="TECNICO">Técnico</option>
                    <option value="AUDITOR_TI">Auditor TI</option>
                    <option value="AUDITOR_INVENTARIO">Auditor Inventario</option>
                    <option value="COORDINADOR">Coordinador</option>
                  </select>
                </Field>
                <Field label="País (opcional)">
                  <input
                    value={editForm.pais}
                    onChange={(e) => setEditForm({ ...editForm, pais: e.target.value })}
                    className="input"
                  />
                </Field>
              </div>
              {editError && <p className="text-xs text-red mb-2">{editError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-1.5 text-xs font-semibold hover:bg-teal/20"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="text-muted hover:text-text text-xs px-3 py-1.5"
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <div key={u.id} className={`flex items-center gap-3 px-4 py-3 flex-wrap ${u.active ? "" : "opacity-55"}`}>
              <div className="flex items-center gap-1.5 min-w-[160px]">
                {u.online && u.active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-teal shrink-0" title="Conectado ahora" />
                )}
                <span className="text-sm font-medium">{u.name}</span>
              </div>
              <span className="text-[11px] text-muted min-w-[100px]">@{u.username}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {!u.active && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-redDim text-red">
                    De baja
                  </span>
                )}
                {u.personnelRole && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blueDim text-blue">
                    {ROLE_LABEL[u.personnelRole]}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-panel text-muted border border-border">
                  {u.role}
                </span>
              </div>
              <span className="text-[11px] text-muted">
                {u.pais || "Sin país fijo"} · {u.tiendasAsignadas} tiendas asignadas
              </span>
              <div className="flex items-center gap-2.5 text-xs ml-auto">
                <button onClick={() => startEdit(u)} className="text-muted hover:text-blue" title="Editar">
                  Editar
                </button>
                <button
                  onClick={() => toggleBaja(u)}
                  className={u.active ? "text-muted hover:text-amber" : "text-teal hover:underline"}
                  title={
                    u.active
                      ? "Bloquea su acceso pero conserva sus tiendas asignadas y su historial"
                      : "Vuelve a darle acceso"
                  }
                >
                  {u.active ? "Dar de baja" : "Reactivar"}
                </button>
                <button
                  onClick={() => quitarDelProyecto(u.id)}
                  className="text-muted2 hover:text-red"
                  title="Lo saca del proyecto y lo desasigna de sus tiendas (se pierde ese registro)"
                >
                  Quitar
                </button>
              </div>
            </div>
          )
        )}
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

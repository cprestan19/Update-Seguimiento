"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

type PersonRow = {
  id: string;
  name: string;
  username: string;
  role: "ADMIN" | "USER";
  personnelRole: "TECNICO" | "AUDITOR_TI" | "AUDITOR_INVENTARIO" | "COORDINADOR" | null;
  pais: string | null;
  active: boolean;
  tiendasAsignadas: number;
};

const ROLE_LABEL: Record<string, string> = {
  TECNICO: "Técnico",
  AUDITOR_TI: "Auditor TI",
  AUDITOR_INVENTARIO: "Auditor Inventario",
  COORDINADOR: "Coordinador",
};

const EMPTY_FORM = {
  name: "",
  username: "",
  password: "",
  role: "USER",
  personnelRole: "TECNICO",
  pais: "",
};

export default function EquipoPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<PersonRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [editError, setEditError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/users");
    if (res.ok) setUsers(await res.json());
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session.user.role !== "ADMIN") {
      router.push("/dashboard");
      return;
    }
    if (status === "authenticated") load();
  }, [status, session, load, router]);

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
    setForm(EMPTY_FORM);
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
    setEditingId(null);
    load();
  }

  async function deactivate(id: string) {
    if (!confirm("¿Eliminar a esta persona? Se desasignará de todas sus tiendas y no podrá iniciar sesión (se puede reactivar después).")) return;
    await fetch(`/api/users/${id}`, { method: "DELETE" });
    load();
  }

  async function reactivate(id: string) {
    await fetch(`/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    load();
  }

  if (status === "loading") return <div className="text-muted text-sm py-10 text-center">Cargando...</div>;

  return (
    <div>
      <h1 className="font-display text-lg mb-1">Equipo de migración</h1>
      <p className="text-xs text-muted mb-6">
        Aquí das de alta a técnicos, auditores TI y auditores de inventario, con su usuario y contraseña de acceso.
      </p>

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {users.map((u) =>
          editingId === u.id ? (
            <form
              key={u.id}
              onSubmit={submitEdit}
              className="bg-panel2 border border-blue/40 rounded-xl p-3.5 md:col-span-2 lg:col-span-3"
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
            <div key={u.id} className="bg-panel2 border border-border rounded-xl p-3.5 relative">
              <div className="absolute top-2.5 right-3 flex items-center gap-2.5 text-xs">
                <button onClick={() => startEdit(u)} className="text-muted hover:text-blue" title="Editar">
                  Editar
                </button>
                {u.active ? (
                  <button onClick={() => deactivate(u.id)} className="text-muted hover:text-red" title="Eliminar">
                    Eliminar
                  </button>
                ) : (
                  <button onClick={() => reactivate(u.id)} className="text-muted hover:text-teal" title="Reactivar">
                    Reactivar
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1.5 mb-1.5 flex-wrap pr-24">
                {u.personnelRole && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-blueDim text-blue">
                    {ROLE_LABEL[u.personnelRole]}
                  </span>
                )}
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-panel text-muted border border-border">
                  {u.role}
                </span>
                {!u.active && (
                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-redDim text-red">
                    Inactivo
                  </span>
                )}
              </div>
              <div className="text-sm font-medium">{u.name}</div>
              <div className="text-[11px] text-muted">@{u.username}</div>
              <div className="text-[11px] text-muted mt-1">
                {u.pais || "Sin país fijo"} · {u.tiendasAsignadas} tiendas asignadas
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

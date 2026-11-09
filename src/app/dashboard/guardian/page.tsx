"use client";

import { useCallback, useEffect, useState } from "react";

type Verification = "UNVERIFIED" | "PENDING" | "VERIFIED" | "AUTHORIZED";
type ScanStatus = "QUEUED" | "RUNNING" | "DONE" | "FAILED";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

type Target = {
  id: string;
  name: string;
  type: "URL" | "REPO";
  url: string;
  description: string | null;
  verification: Verification;
  verificationToken: string | null;
  authorizedByName: string | null;
};

type Scan = {
  id: string;
  profile: "SAFE" | "FULL";
  types: string[];
  status: ScanStatus;
  createdAt: string;
  finishedAt: string | null;
  error?: string | null;
  countCritical: number;
  countHigh: number;
  countMedium: number;
  countLow: number;
  countInfo: number;
};

type Finding = {
  id: string;
  type: string;
  severity: Severity;
  status: string;
  title: string;
  description: string;
  location: string | null;
  evidence: string | null;
  recommendation: string | null;
  cwe: string | null;
  owasp: string | null;
};

const SEV_STYLE: Record<Severity, string> = {
  CRITICAL: "bg-red/20 text-red border-red/40",
  HIGH: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  MEDIUM: "bg-yellow-500/15 text-yellow-400 border-yellow-500/40",
  LOW: "bg-blue/15 text-blue border-blue/40",
  INFO: "bg-panel2 text-muted border-border",
};

const VERIF_LABEL: Record<Verification, string> = {
  UNVERIFIED: "Sin verificar",
  PENDING: "Pendiente",
  VERIFIED: "Verificado",
  AUTHORIZED: "Autorizado",
};

export default function GuardianPage() {
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [selected, setSelected] = useState<Target | null>(null);
  const [scans, setScans] = useState<Scan[]>([]);
  const [openScan, setOpenScan] = useState<string | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // Alta de objetivo
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", type: "URL" as "URL" | "REPO", url: "", description: "" });

  // Verificación
  const [verifyInfo, setVerifyInfo] = useState<{ token: string; dns: string; file: string } | null>(null);

  const loadTargets = useCallback(async () => {
    const res = await fetch("/api/guardian/targets");
    if (res.ok) setTargets(await res.json());
  }, []);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  const loadScans = useCallback(async (targetId: string) => {
    const res = await fetch(`/api/guardian/scans?targetId=${targetId}`);
    if (res.ok) setScans(await res.json());
  }, []);

  async function selectTarget(t: Target) {
    setSelected(t);
    setOpenScan(null);
    setFindings([]);
    setVerifyInfo(null);
    await loadScans(t.id);
  }

  async function createTarget(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    const res = await fetch("/api/guardian/targets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "No se pudo crear");
    setShowNew(false);
    setForm({ name: "", type: "URL", url: "", description: "" });
    await loadTargets();
  }

  async function runScan(profile: "SAFE" | "FULL") {
    if (!selected) return;
    setMsg(null);
    const res = await fetch("/api/guardian/scans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetId: selected.id, profile }),
    });
    const data = await res.json();
    if (!res.ok) return setMsg(data.error || "No se pudo iniciar el escaneo");
    setMsg("Escaneo iniciado. Actualizando resultados…");
    await loadScans(selected.id);
    pollScan(data.id);
  }

  function pollScan(scanId: string) {
    const iv = setInterval(async () => {
      if (!selected) return clearInterval(iv);
      const res = await fetch(`/api/guardian/scans?targetId=${selected.id}`);
      if (res.ok) {
        const list: Scan[] = await res.json();
        setScans(list);
        const s = list.find((x) => x.id === scanId);
        if (s && (s.status === "DONE" || s.status === "FAILED")) {
          clearInterval(iv);
          setMsg(s.status === "DONE" ? "Escaneo completado." : "El escaneo falló.");
        }
      }
    }, 3000);
    setTimeout(() => clearInterval(iv), 300000);
  }

  async function verify() {
    if (!selected) return;
    setMsg(null);
    const res = await fetch(`/api/guardian/targets/${selected.id}/verify`, { method: "POST" });
    const data = await res.json();
    if (data.verified) {
      setMsg(`Propiedad verificada (${data.method}).`);
      setVerifyInfo(null);
      await loadTargets();
      await selectTarget({ ...selected, verification: "VERIFIED" });
    } else {
      setVerifyInfo({ token: data.token, dns: data.instructions.dns, file: data.instructions.file });
      setMsg("Aún no se detecta el token. Publícalo y reintenta.");
    }
  }

  async function openFindings(scanId: string) {
    if (openScan === scanId) {
      setOpenScan(null);
      return;
    }
    const res = await fetch(`/api/guardian/scans/${scanId}`);
    if (res.ok) {
      const data = await res.json();
      setFindings(data.findings || []);
      setOpenScan(scanId);
    }
  }

  async function setFindingStatus(id: string, status: string) {
    const res = await fetch(`/api/guardian/findings/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) setFindings((f) => f.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-lg flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal to-blue flex items-center justify-center text-[#04110F] text-xs font-bold">G</span>
            Guardian ToolsIT
          </h1>
          <p className="text-xs text-muted mt-1">Auditoría de seguridad y pentest de aplicativos. Las pruebas intrusivas solo corren contra objetivos verificados o autorizados.</p>
        </div>
        <button onClick={() => setShowNew((v) => !v)} className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20">
          + Nuevo objetivo
        </button>
      </div>

      {msg && <div className="text-xs bg-panel2 border border-border rounded-lg px-3 py-2 text-muted">{msg}</div>}

      {showNew && (
        <form onSubmit={createTarget} className="bg-panel border border-border rounded-2xl p-5 space-y-3">
          <div className="grid md:grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre (ej. App del cliente X)" className="bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" />
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as "URL" | "REPO" })} className="bg-panel2 border border-border rounded-lg px-3 py-2 text-sm">
              <option value="URL">URL (app web / SaaS)</option>
              <option value="REPO">Repositorio (GitHub público)</option>
            </select>
          </div>
          <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder={form.type === "URL" ? "https://app.cliente.com" : "https://github.com/org/repo"} className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" />
          <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción (opcional)" className="w-full bg-panel2 border border-border rounded-lg px-3 py-2 text-sm" />
          <button type="submit" className="bg-tealDim text-teal border border-teal/30 rounded-lg px-4 py-2 text-sm font-semibold hover:bg-teal/20">Crear objetivo</button>
        </form>
      )}

      <div className="grid md:grid-cols-[320px_1fr] gap-5">
        {/* Lista de objetivos */}
        <div className="space-y-2">
          {targets === null && <p className="text-sm text-muted">Cargando…</p>}
          {targets?.length === 0 && <p className="text-sm text-muted">No hay objetivos todavía.</p>}
          {targets?.map((t) => (
            <button key={t.id} onClick={() => selectTarget(t)} className={`w-full text-left bg-panel border rounded-xl px-4 py-3 transition ${selected?.id === t.id ? "border-teal/50" : "border-border hover:border-border/80"}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{t.name}</span>
                <span className="text-[9px] uppercase tracking-wide text-muted2 shrink-0 border border-border rounded px-1.5 py-0.5">{t.type}</span>
              </div>
              <div className="text-[11px] text-muted truncate mt-0.5">{t.url}</div>
              <div className="text-[10px] mt-1 text-muted2">{VERIF_LABEL[t.verification]}</div>
            </button>
          ))}
        </div>

        {/* Detalle */}
        <div>
          {!selected && <div className="bg-panel border border-border rounded-2xl p-8 text-sm text-muted text-center">Selecciona un objetivo para ver sus escaneos.</div>}
          {selected && (
            <div className="space-y-4">
              <div className="bg-panel border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h2 className="font-display text-base">{selected.name}</h2>
                    <a href={selected.url} target="_blank" rel="noreferrer" className="text-xs text-blue hover:underline break-all">{selected.url}</a>
                  </div>
                  <span className="text-[11px] border border-border rounded-lg px-2 py-1 text-muted">{VERIF_LABEL[selected.verification]}</span>
                </div>

                <div className="flex gap-2 mt-4 flex-wrap">
                  <button onClick={() => runScan("SAFE")} className="bg-tealDim text-teal border border-teal/30 rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-teal/20">
                    Escaneo seguro
                  </button>
                  <button onClick={() => runScan("FULL")} className="bg-panel2 text-text border border-border rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-teal/40" title="Requiere objetivo verificado o autorizado">
                    Escaneo completo (intrusivo)
                  </button>
                  {selected.type === "URL" && selected.verification !== "VERIFIED" && selected.verification !== "AUTHORIZED" && (
                    <button onClick={verify} className="bg-panel2 text-text border border-border rounded-lg px-3 py-1.5 text-xs font-semibold hover:border-teal/40">
                      Verificar propiedad
                    </button>
                  )}
                </div>

                {verifyInfo && (
                  <div className="mt-3 bg-panel2 border border-border rounded-lg p-3 text-[11px] text-muted space-y-1">
                    <p className="text-text font-semibold">Para verificar la propiedad, publica este token y vuelve a pulsar &quot;Verificar&quot;:</p>
                    <p className="font-mono text-teal break-all">{verifyInfo.token}</p>
                    <p>• {verifyInfo.dns}</p>
                    <p>• {verifyInfo.file}</p>
                  </div>
                )}
              </div>

              {/* Escaneos */}
              <div className="space-y-2">
                {scans.length === 0 && <p className="text-sm text-muted">Sin escaneos aún.</p>}
                {scans.map((s) => (
                  <div key={s.id} className="bg-panel border border-border rounded-xl">
                    <button onClick={() => openFindings(s.id)} className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left">
                      <div>
                        <div className="text-xs font-medium">
                          {s.profile === "FULL" ? "Completo" : "Seguro"} · {new Date(s.createdAt).toLocaleString()}
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">{s.types.join(", ")}</div>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        {s.status !== "DONE" ? (
                          <span className="text-muted uppercase">{s.status}</span>
                        ) : (
                          <>
                            {s.countCritical > 0 && <span className={`border rounded px-1.5 py-0.5 ${SEV_STYLE.CRITICAL}`}>{s.countCritical} C</span>}
                            {s.countHigh > 0 && <span className={`border rounded px-1.5 py-0.5 ${SEV_STYLE.HIGH}`}>{s.countHigh} A</span>}
                            {s.countMedium > 0 && <span className={`border rounded px-1.5 py-0.5 ${SEV_STYLE.MEDIUM}`}>{s.countMedium} M</span>}
                            {s.countCritical + s.countHigh + s.countMedium === 0 && <span className="text-teal">Sin hallazgos altos</span>}
                          </>
                        )}
                      </div>
                    </button>

                    {openScan === s.id && (
                      <div className="border-t border-border p-4 space-y-3">
                        {findings.length === 0 && <p className="text-xs text-muted">Sin hallazgos registrados.</p>}
                        {findings.map((f) => (
                          <div key={f.id} className="bg-panel2 border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className={`text-[10px] border rounded px-1.5 py-0.5 ${SEV_STYLE[f.severity]}`}>{f.severity}</span>
                              <span className="text-[10px] text-muted2">{f.owasp || f.cwe || f.type}</span>
                            </div>
                            <h4 className="text-sm font-medium mt-1.5">{f.title}</h4>
                            <p className="text-xs text-muted mt-1">{f.description}</p>
                            {f.location && <p className="text-[11px] text-muted2 mt-1 font-mono break-all">{f.location}</p>}
                            {f.evidence && <pre className="text-[10px] bg-bg border border-border rounded p-2 mt-1 overflow-x-auto text-muted">{f.evidence}</pre>}
                            {f.recommendation && <p className="text-[11px] text-teal mt-1">→ {f.recommendation}</p>}
                            <div className="flex items-center gap-1.5 mt-2">
                              <span className="text-[10px] text-muted2 mr-1">Estado: {f.status}</span>
                              {["CONFIRMED", "FIXED", "FALSE_POSITIVE"].map((st) => (
                                <button key={st} onClick={() => setFindingStatus(f.id, st)} className="text-[10px] border border-border rounded px-1.5 py-0.5 text-muted hover:text-text hover:border-teal/40">
                                  {st === "CONFIRMED" ? "Confirmar" : st === "FIXED" ? "Corregido" : "Falso positivo"}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

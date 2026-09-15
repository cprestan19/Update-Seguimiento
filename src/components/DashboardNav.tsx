"use client";

import { useEffect, useState } from "react";
import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" };

export default function DashboardNav({
  name,
  projectName,
  role,
}: {
  name: string;
  projectName: string;
  role: "ADMIN" | "USER" | "MONITOR";
}) {
  const pathname = usePathname();

  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [showSwitcher, setShowSwitcher] = useState(false);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    function ping() {
      fetch("/api/users/heartbeat", { method: "POST" }).catch(() => {});
    }
    ping();
    const interval = setInterval(ping, 60_000);
    return () => clearInterval(interval);
  }, []);

  async function openSwitcher() {
    setShowSwitcher((v) => !v);
    if (projects.length === 0) {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    }
  }

  async function switchProject(projectId: string) {
    setSwitching(true);
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    window.location.href = "/dashboard";
  }

  const linkClass = (href: string) =>
    `text-sm px-3 py-1.5 rounded-lg transition ${
      pathname === href ? "bg-panel2 text-text" : "text-muted hover:text-text"
    }`;

  return (
    <div className="border-b border-border bg-gradient-to-b from-[#0D1219] to-bg">
      <div className="max-w-[1400px] mx-auto px-4 md:px-7 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-blue flex items-center justify-center font-bold text-[#04110F] text-xs font-display">
            TI
          </div>
          <div className="leading-tight relative">
            <button
              type="button"
              onClick={openSwitcher}
              className="text-sm font-semibold font-display flex items-center gap-1.5 hover:text-teal transition"
            >
              {projectName}
              <span className="text-[10px] text-muted">▾</span>
            </button>
            <div className="text-[11px] text-muted">Panel de control operativo</div>

            {showSwitcher && (
              <div className="absolute left-0 top-full mt-2 z-20 bg-panel2 border border-border rounded-lg p-2 min-w-[220px] shadow-lg">
                <div className="text-[10px] uppercase tracking-wide text-muted px-2 pb-1.5">Tus proyectos</div>
                <ul className="space-y-0.5">
                  {projects.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        disabled={switching}
                        onClick={() => switchProject(p.id)}
                        className={`w-full text-left text-xs px-2 py-1.5 rounded-md hover:bg-panel transition flex items-center justify-between gap-2 ${
                          p.name === projectName ? "text-teal" : "text-text"
                        }`}
                      >
                        <span className="truncate">{p.name}</span>
                        <span className="text-[10px] text-muted shrink-0">{p.role}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-border mt-1.5 pt-1.5">
                  <Link
                    href="/dashboard/proyectos"
                    onClick={() => setShowSwitcher(false)}
                    className="block text-xs px-2 py-1.5 rounded-md text-teal hover:bg-panel transition"
                  >
                    + Nuevo proyecto
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
          </Link>
          <Link href="/dashboard/seguimiento" className={linkClass("/dashboard/seguimiento")}>
            Seguimiento
          </Link>
          {role === "ADMIN" && (
            <Link href="/dashboard/equipo" className={linkClass("/dashboard/equipo")}>
              Equipo
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium">{name}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide">{role}</div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-muted hover:text-red border border-border rounded-lg px-3 py-1.5 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </div>
  );
}

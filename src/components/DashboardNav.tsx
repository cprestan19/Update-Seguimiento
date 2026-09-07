"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function DashboardNav({
  name,
  role,
}: {
  name: string;
  role: "ADMIN" | "USER";
}) {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `text-sm px-3 py-1.5 rounded-lg transition ${
      pathname === href ? "bg-panel2 text-text" : "text-muted hover:text-text"
    }`;

  return (
    <div className="border-b border-border bg-gradient-to-b from-[#0D1219] to-bg">
      <div className="max-w-[1400px] mx-auto px-4 md:px-7 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-blue flex items-center justify-center font-bold text-[#04110F] text-xs font-display">
            P2
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold font-display">Control de Migración</div>
            <div className="text-[11px] text-muted">RPro v9 → Prism 2.2</div>
          </div>
        </div>

        <nav className="flex items-center gap-1">
          <Link href="/dashboard" className={linkClass("/dashboard")}>
            Dashboard
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

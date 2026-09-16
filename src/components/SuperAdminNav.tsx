"use client";

import { signOut } from "next-auth/react";

export default function SuperAdminNav({ name }: { name: string }) {
  return (
    <div className="border-b border-border bg-gradient-to-b from-[#0D1219] to-bg">
      <div className="max-w-[1000px] mx-auto px-4 md:px-7 py-3.5 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-blue flex items-center justify-center font-bold text-[#04110F] text-xs font-display">
            TI
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold font-display">Panel global</div>
            <div className="text-[11px] text-muted">Todos los departamentos</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right leading-tight">
            <div className="text-xs font-medium">{name}</div>
            <div className="text-[10px] text-muted uppercase tracking-wide">Super admin</div>
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

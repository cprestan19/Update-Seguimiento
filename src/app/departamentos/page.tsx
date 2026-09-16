"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

type DepartmentOption = { id: string; name: string; slug: string; projectCount: number };

export default function DepartamentosPage() {
  const { status } = useSession();
  const router = useRouter();
  const [departments, setDepartments] = useState<DepartmentOption[] | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/departments")
      .then((r) => r.json())
      .then((data) => setDepartments(data.departments || []));
  }, [status]);

  if (status === "loading" || departments === null) {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">Cargando...</div>;
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl p-8">
        <h1 className="font-display text-base mb-1">Departamentos</h1>
        <p className="text-xs text-muted mb-5">
          Elige un departamento para entrar a su sección de proyectos.
        </p>

        {departments.length === 0 ? (
          <p className="text-sm text-muted text-center py-4">Todavía no hay departamentos creados.</p>
        ) : (
          <div className="space-y-2">
            {departments.map((d) => (
              <Link
                key={d.id}
                href={`/departamentos/${d.id}`}
                className="w-full text-left bg-panel2 border border-border rounded-xl px-4 py-3 hover:border-teal/40 transition flex items-center justify-between"
              >
                <span className="text-sm font-medium">{d.name}</span>
                <span className="text-[10px] uppercase tracking-wide text-muted">
                  {d.projectCount} proyecto{d.projectCount === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between mt-6">
          <Link href="/dashboard" className="text-xs text-muted hover:text-text">
            &larr; Volver
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-xs text-muted hover:text-red border border-border rounded-lg px-3 py-1.5 transition"
          >
            Salir
          </button>
        </div>
      </div>
    </main>
  );
}

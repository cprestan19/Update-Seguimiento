"use client";

import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type ProjectOption = { id: string; name: string; slug: string; role: "ADMIN" | "USER" | "MONITOR" };

export default function OnboardingPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectOption[] | null>(null);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  const isSuperAdmin = Boolean((session?.user as unknown as { isSuperAdmin?: boolean })?.isSuperAdmin);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (isSuperAdmin) {
      router.push("/superadmin");
      return;
    }
    (async () => {
      const res = await fetch("/api/projects");
      if (!res.ok) return;
      const data = await res.json();
      const list: ProjectOption[] = data.projects || [];

      if (list.length === 1) {
        await activate(list[0].id);
        return;
      }
      if (list.length > 1 && data.lastActiveProjectId && list.some((p) => p.id === data.lastActiveProjectId)) {
        await activate(data.lastActiveProjectId);
        return;
      }
      setProjects(list);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function activate(projectId: string) {
    setSwitching(true);
    await fetch("/api/projects/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId }),
    });
    window.location.href = "/dashboard";
  }

  if (status === "loading" || projects === null || switching) {
    return <div className="min-h-screen flex items-center justify-center bg-bg text-muted text-sm">Cargando...</div>;
  }

  if (projects.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-bg px-4">
        <div className="w-full max-w-sm bg-panel border border-border rounded-2xl p-8 text-center">
          <h1 className="font-display text-base mb-2">Sin proyectos asignados</h1>
          <p className="text-sm text-muted mb-6">
            Todavía no perteneces a ningún proyecto. Pide a un administrador que te agregue a uno, o entra a la
            sección de departamentos si tienes la contraseña de alguno.
          </p>
          <div className="flex items-center justify-center gap-2">
            <Link
              href="/departamentos"
              className="text-xs text-teal hover:underline border border-teal/30 rounded-lg px-4 py-2 transition"
            >
              Departamentos
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-xs text-muted hover:text-red border border-border rounded-lg px-4 py-2 transition"
            >
              Salir
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-panel border border-border rounded-2xl p-8">
        <h1 className="font-display text-base mb-1">Elige un proyecto</h1>
        <p className="text-xs text-muted mb-5">Puedes cambiar de proyecto luego desde el panel.</p>
        <div className="space-y-2">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => activate(p.id)}
              className="w-full text-left bg-panel2 border border-border rounded-xl px-4 py-3 hover:border-teal/40 transition flex items-center justify-between"
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-[10px] uppercase tracking-wide text-muted">{p.role}</span>
            </button>
          ))}
        </div>
      </div>
    </main>
  );
}

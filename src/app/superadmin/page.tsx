import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/departmentContext";
import { getDepartmentSummary } from "@/lib/superadminSummary";
import SuperAdminNav from "@/components/SuperAdminNav";
import SuperAdminDashboard from "./SuperAdminDashboard";

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (!isSuperAdmin(session)) redirect("/dashboard");

  const departments = await getDepartmentSummary();

  return (
    <div className="min-h-screen bg-bg text-text">
      <SuperAdminNav name={session.user.name || session.user.username} />
      <main className="max-w-[1000px] mx-auto px-4 md:px-7 py-6">
        <h1 className="font-display text-lg mb-1">Panel global</h1>
        <p className="text-xs text-muted mb-6">Resumen de todos los departamentos y sus proyectos.</p>
        <SuperAdminDashboard initialDepartments={departments} />
      </main>
    </div>
  );
}

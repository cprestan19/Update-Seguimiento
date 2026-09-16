import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import DashboardNav from "@/components/DashboardNav";
import { ProjectProvider } from "@/components/ProjectProvider";
import { getProjectContext } from "@/lib/projectContext";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const ctx = await getProjectContext();
  if (!ctx) redirect("/onboarding");

  return (
    <div className="min-h-screen bg-bg text-text">
      <ProjectProvider
        value={{
          projectId: ctx.projectId,
          projectName: ctx.project.name,
          role: ctx.role,
          personnelRole: ctx.personnelRole,
          isMigrationProject: ctx.isMigrationProject,
        }}
      >
        <DashboardNav
          name={session.user.name || session.user.username}
          projectName={ctx.project.name}
          role={ctx.role}
          isSuperAdmin={Boolean((session.user as unknown as { isSuperAdmin?: boolean }).isSuperAdmin)}
        />
        <main className="max-w-[1400px] mx-auto px-4 md:px-7 py-6">{children}</main>
      </ProjectProvider>
    </div>
  );
}

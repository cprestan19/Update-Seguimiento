import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import DashboardNav from "@/components/DashboardNav";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-bg text-text">
      <DashboardNav
        name={session.user.name || session.user.username}
        role={session.user.role}
      />
      <main className="max-w-[1400px] mx-auto px-4 md:px-7 py-6">{children}</main>
    </div>
  );
}

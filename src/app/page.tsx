import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/departmentContext";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  redirect(isSuperAdmin(session) ? "/superadmin" : "/dashboard");
}

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/departmentContext";
import { getDepartmentSummary } from "@/lib/superadminSummary";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (!isSuperAdmin(session)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const departments = await getDepartmentSummary();
  return NextResponse.json({ departments });
}

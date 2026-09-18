import { NextResponse } from "next/server";
import { getProjectContext } from "@/lib/projectContext";
import { getRequirementSummary } from "@/lib/requirementSummary";

export async function GET() {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const summary = await getRequirementSummary(ctx.projectId);
  return NextResponse.json(summary);
}

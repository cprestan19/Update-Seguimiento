import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIVE_PROJECT_COOKIE } from "@/lib/projectContext";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { projectId } = (await req.json()) as { projectId: string };
  if (!projectId) return NextResponse.json({ error: "Falta projectId" }, { status: 400 });

  const member = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: session.user.id } },
    include: { project: { select: { active: true } } },
  });
  if (!member || !member.project.active) {
    return NextResponse.json({ error: "No perteneces a ese proyecto" }, { status: 403 });
  }

  cookies().set(ACTIVE_PROJECT_COOKIE, projectId, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180,
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { lastActiveProjectId: projectId },
  });

  return NextResponse.json({ ok: true });
}

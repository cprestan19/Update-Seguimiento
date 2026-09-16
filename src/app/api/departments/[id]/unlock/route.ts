import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const department = await prisma.department.findFirst({ where: { id: params.id, active: true } });
  if (!department) return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });

  const { password } = (await req.json()) as { password?: string };
  if (!password) return NextResponse.json({ error: "Falta la contraseña" }, { status: 400 });

  const valid = await bcrypt.compare(password, department.adminPasswordHash);
  if (!valid) return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });

  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "DEPARTAMENTO_DESBLOQUEADO", detalle: department.name },
  });

  return NextResponse.json({ ok: true });
}

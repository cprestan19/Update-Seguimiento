import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import bcrypt from "bcryptjs";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { issueDeptUnlockToken } from "@/lib/deptUnlockToken";
import { UNLOCK_LIMIT, hitAttempt, peekAttempts, resetAttempts } from "@/lib/rateLimit";

// Valida la contraseña compartida del departamento y, si es correcta,
// devuelve un comprobante firmado y de vida corta. El cliente lo entrega a
// useSession().update({ deptUnlockToken }) y el callback jwt lo verifica
// antes de agregar el departamento a la sesión.
export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const department = await prisma.department.findFirst({ where: { id: params.id, active: true } });
  if (!department) return NextResponse.json({ error: "Departamento no encontrado" }, { status: 404 });

  const key = `unlock:${session.user.id}:${department.id}`;
  const limit = await peekAttempts(key, UNLOCK_LIMIT.perUserDept);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Demasiados intentos fallidos. Intenta de nuevo en unos minutos." },
      { status: 429 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as { password?: unknown };
  const password = typeof body.password === "string" ? body.password : "";
  if (!password || password.length > 200) {
    return NextResponse.json({ error: "Falta la contraseña" }, { status: 400 });
  }

  const valid = await bcrypt.compare(password, department.adminPasswordHash);
  if (!valid) {
    await hitAttempt(key, UNLOCK_LIMIT.windowSec);
    await prisma.auditLog.create({
      data: { userId: session.user.id, accion: "DEPARTAMENTO_DESBLOQUEO_FALLIDO", detalle: department.name },
    });
    return NextResponse.json({ error: "Contraseña incorrecta" }, { status: 401 });
  }

  await resetAttempts(key);
  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "DEPARTAMENTO_DESBLOQUEADO", detalle: department.name },
  });

  return NextResponse.json({ ok: true, unlockToken: issueDeptUnlockToken(session.user.id, department.id) });
}

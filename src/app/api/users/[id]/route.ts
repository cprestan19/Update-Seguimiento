import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Desactiva el usuario (no lo borra físicamente, para conservar el historial de auditoría)
// y lo desasigna de cualquier tienda donde estuviera participando.
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Solo un administrador puede quitar personal" }, { status: 403 });
  }
  if (session.user.id === params.id) {
    return NextResponse.json({ error: "No puedes desactivar tu propio usuario" }, { status: 400 });
  }

  await prisma.store.updateMany({ where: { tecnicoId: params.id }, data: { tecnicoId: null } });
  await prisma.store.updateMany({ where: { auditorTIId: params.id }, data: { auditorTIId: null } });
  await prisma.store.updateMany({ where: { auditorInvId: params.id }, data: { auditorInvId: null } });

  const user = await prisma.user.update({
    where: { id: params.id },
    data: { active: false },
  });

  await prisma.auditLog.create({
    data: { userId: session.user.id, accion: "USUARIO_DESACTIVADO", detalle: user.username },
  });

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProjectContext } from "@/lib/projectContext";
import { checkOwnership, newVerificationToken } from "@/lib/guardian/ownership";

// POST sin cuerpo: comprueba la propiedad (DNS TXT o /.well-known).
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role === "MONITOR") return NextResponse.json({ error: "El rol Monitor solo puede ver" }, { status: 403 });

  const target = await prisma.guardianTarget.findFirst({ where: { id: params.id, projectId: ctx.projectId } });
  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });
  if (target.type !== "URL") return NextResponse.json({ error: "Solo los objetivos URL se verifican por propiedad" }, { status: 400 });

  let token = target.verificationToken;
  if (!token) {
    token = newVerificationToken();
    await prisma.guardianTarget.update({ where: { id: target.id }, data: { verificationToken: token } });
  }

  const result = await checkOwnership(target.url, token);
  if (result.verified) {
    await prisma.guardianTarget.update({
      where: { id: target.id },
      data: { verification: "VERIFIED", verifiedAt: new Date() },
    });
    await prisma.auditLog.create({
      data: {
        userId: ctx.userId,
        projectId: ctx.projectId,
        accion: "GUARDIAN_TARGET_VERIFICADO",
        entidad: `GuardianTarget:${target.id}`,
        detalle: `Método: ${result.method}`,
      },
    });
    return NextResponse.json({ verified: true, method: result.method });
  }

  await prisma.guardianTarget.update({ where: { id: target.id }, data: { verification: "PENDING" } });
  return NextResponse.json({
    verified: false,
    token,
    instructions: {
      dns: `Crea un registro DNS TXT en el dominio con el valor: ${token}`,
      file: `O publica el archivo /.well-known/guardian-verify.txt con el contenido: ${token}`,
    },
  });
}

// PATCH: registrar una autorización escrita (alternativa a la verificación
// técnica), por ejemplo cuando el cliente firma un contrato de pentest.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const ctx = await getProjectContext();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  if (ctx.role !== "ADMIN") return NextResponse.json({ error: "Solo un administrador puede registrar autorizaciones" }, { status: 403 });

  const { authorizedByName, authorizationNote } = (await req.json().catch(() => ({}))) as {
    authorizedByName?: string;
    authorizationNote?: string;
  };
  if (!authorizedByName?.trim()) {
    return NextResponse.json({ error: "Indica quién autoriza la prueba" }, { status: 400 });
  }

  const target = await prisma.guardianTarget.findFirst({ where: { id: params.id, projectId: ctx.projectId } });
  if (!target) return NextResponse.json({ error: "Objetivo no encontrado" }, { status: 404 });

  await prisma.guardianTarget.update({
    where: { id: target.id },
    data: {
      verification: "AUTHORIZED",
      authorizedByName: authorizedByName.trim(),
      authorizationNote: authorizationNote?.trim() || null,
    },
  });
  await prisma.auditLog.create({
    data: {
      userId: ctx.userId,
      projectId: ctx.projectId,
      accion: "GUARDIAN_TARGET_AUTORIZADO",
      entidad: `GuardianTarget:${target.id}`,
      detalle: `Autoriza: ${authorizedByName.trim()}`,
    },
  });

  return NextResponse.json({ ok: true });
}

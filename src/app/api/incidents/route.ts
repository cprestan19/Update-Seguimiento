import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const { storeId, severidad, descripcion } = (await req.json()) as {
    storeId: string;
    severidad: "BAJA" | "MEDIA" | "ALTA" | "CRITICA";
    descripcion: string;
  };

  if (!storeId || !descripcion?.trim()) {
    return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
  }

  const incident = await prisma.incident.create({
    data: {
      storeId,
      severidad: severidad || "MEDIA",
      descripcion: descripcion.trim(),
      createdById: session.user.id,
    },
  });

  await prisma.store.update({
    where: { id: storeId },
    data: { estado: "CON_INCIDENCIA" },
  });

  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      accion: "INCIDENCIA_CREADA",
      entidad: `Store:${storeId}`,
      detalle: descripcion.trim(),
    },
  });

  return NextResponse.json(incident);
}

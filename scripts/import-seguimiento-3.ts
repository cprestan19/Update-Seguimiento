// Tercera tanda de temas de seguimiento post-migración (San Martín).
// Uso: DATABASE_URL="..." npx tsx scripts/import-seguimiento-3.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = {
  region: string;
  tienda: string | null;
  descripcion: string;
  estado: "PENDIENTE" | "COMPLETADO";
};

const ROWS: Row[] = [
  {
    region: "San Martin",
    tienda: null,
    descripcion: "La impresión de la factura ofrece muchas opciones para elegir.",
    estado: "PENDIENTE",
  },
  {
    region: "San Martin",
    tienda: null,
    descripcion: "El personal de ventas no puede marcar entrada o salida.",
    estado: "PENDIENTE",
  },
];

async function main() {
  let created = 0;
  for (const row of ROWS) {
    await prisma.seguimientoItem.create({
      data: {
        region: row.region,
        tienda: row.tienda,
        descripcion: row.descripcion,
        estado: row.estado,
        completadoEn: row.estado === "COMPLETADO" ? new Date() : null,
      },
    });
    created++;
  }
  console.log(`Creados ${created} ítems de seguimiento (San Martín).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

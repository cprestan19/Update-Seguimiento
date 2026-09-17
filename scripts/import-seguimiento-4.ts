// Cuarta tanda de temas de seguimiento post-migración (Belice y Aruba).
// Uso: DATABASE_URL="..." npx tsx scripts/import-seguimiento-4.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_SLUG = "rpro-prism";

type Row = {
  region: string;
  tienda: string | null;
  descripcion: string;
  estado: "PENDIENTE" | "COMPLETADO";
};

const ROWS: Row[] = [
  { region: "Belice", tienda: null, descripcion: "Lentitud en el programa.", estado: "PENDIENTE" },
  { region: "Belice", tienda: null, descripcion: "No tienen acceso a la reportería.", estado: "PENDIENTE" },
  {
    region: "Belice",
    tienda: null,
    descripcion: "Problemas de licencias; no los deja entrar en 2 cajas.",
    estado: "PENDIENTE",
  },
  {
    region: "Aruba",
    tienda: null,
    descripcion: "Marcaciones de entrada y salida de vendedores.",
    estado: "PENDIENTE",
  },
  {
    region: "Aruba",
    tienda: null,
    descripcion: "No se puede vender y canjear giftcard.",
    estado: "PENDIENTE",
  },
  { region: "Aruba", tienda: null, descripcion: "No encuentran clientes.", estado: "PENDIENTE" },
];

async function main() {
  const project = await prisma.project.findUnique({ where: { slug: PROJECT_SLUG } });
  if (!project) {
    console.error(`No existe el proyecto con slug "${PROJECT_SLUG}"`);
    process.exit(1);
  }

  let created = 0;
  for (const row of ROWS) {
    await prisma.seguimientoItem.create({
      data: {
        projectId: project.id,
        region: row.region,
        tienda: row.tienda,
        descripcion: row.descripcion,
        estado: row.estado,
        completadoEn: row.estado === "COMPLETADO" ? new Date() : null,
      },
    });
    created++;
  }
  console.log(`Creados ${created} ítems de seguimiento (Belice y Aruba) en "${project.name}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

// Segunda tanda de temas de seguimiento post-migración (Curacao).
// Uso: DATABASE_URL="..." npx tsx scripts/import-seguimiento-2.ts
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
    region: "Curacao",
    tienda: null,
    descripcion:
      "Las facturas ya se están imprimiendo pero no tienen el Crib Number (Registro de Información Fiscal); es importante que se incluya en la facturación.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion:
      "Problemas con el RetailApp (a veces abre y otras no). Se hizo un HelpNow #27658; al momento del reporte ya se tenía acceso de nuevo.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion: "Las facturas no tienen la fecha del día; marca 00/00/0000 12:00 AM.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion:
      "Si la cajera está utilizando la caja 80:80 no se puede abrir la 80:81, sale un error (ya pasó en TH Punda y se solucionó). Ocurre de forma intermitente.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion: "No se pueden ver las marcaciones de empleados en el sistema; hay que entrar a la reportería.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion:
      "Al marcar entradas y salidas, cualquier persona puede hacerlo por otro empleado; cada quien debería marcar con su propia contraseña.",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion:
      "En el RetailApp, al efectuar depósitos en efectivo, el sistema no permite enviar el depósito de Florines; solo indica Dólar (comenzó de un día para otro).",
    estado: "PENDIENTE",
  },
  {
    region: "Curacao",
    tienda: null,
    descripcion:
      "Al realizar transferencias no toma la cantidad completa; hay que hacer otra transferencia aparte para completar la solicitud.",
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
  console.log(`Creados ${created} ítems de seguimiento (Curacao).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

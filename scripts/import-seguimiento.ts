// Carga puntual de los temas de seguimiento post-migración reportados por las tiendas.
// Uso: DATABASE_URL="..." npx tsx scripts/import-seguimiento.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Row = {
  region: string;
  tienda: string | null;
  descripcion: string;
  estado: "PENDIENTE" | "COMPLETADO";
};

const ROWS: Row[] = [
  // Uruguay
  {
    region: "Uruguay",
    tienda: "Bodega Punta del Este",
    descripcion:
      "Transferencias entre bodega y tienda: varios ítems no dejan transferir su totalidad, agarra la mitad o dice que el ítem no tiene stock.",
    estado: "PENDIENTE",
  },
  {
    region: "Uruguay",
    tienda: "Tienda Punta del Este",
    descripcion: "Hicieron transfers pequeños y no visualizan los ASN para recibir.",
    estado: "PENDIENTE",
  },
  {
    region: "Uruguay",
    tienda: "Todos",
    descripcion: "Las marcaciones de entrada y salida no se están pudiendo hacer.",
    estado: "PENDIENTE",
  },
  {
    region: "Uruguay",
    tienda: "Ambas tiendas TH",
    descripcion:
      "Los gift cards no se están pudiendo descontar de las compras, se suman en vez de restar por el monto correspondiente de la gift.",
    estado: "PENDIENTE",
  },
  {
    region: "Uruguay",
    tienda: "TH y CK Punta Carretas",
    descripcion:
      "Las licencias no permiten al usuario estar en más de una PC y les bloquea todo; también hay problema con la computadora de ecom y demás.",
    estado: "PENDIENTE",
  },
  {
    region: "Uruguay",
    tienda: "KL Punta del Este",
    descripcion:
      "No puede dar imprimir el Z out, no está funcionando ese botón y tienen que ir por otro lado para imprimir el reporte Z.",
    estado: "PENDIENTE",
  },

  // El Salvador
  {
    region: "El Salvador",
    tienda: null,
    descripcion:
      "Al buscar a cualquier cliente previamente creado o nuevo, por número de documento (DUI), no se encuentran. A veces al realizarlo por nombre funciona, pero en muchas otras ocasiones no.",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion:
      "No aparece la opción de buscar un cliente por NCR, cuando es CCF, que facilita la operación (antes sí daba esa opción).",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion:
      "Al crear un nuevo cliente de CCF, no aparecen todos los campos que corresponden: NIT, NCR, correo, actividad económica, teléfono, tipo de contribuyente (pequeño, mediano y grande).",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion:
      "Al crear un nuevo cliente para factura o ticket, no se está guardando todos los datos, solo NOMBRE y APELLIDO. Se ingresa DUI, correo, etc. y no los registra; al ver el cliente en DETALLE no aparecen.",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion: "Muy tardada la respuesta cuando se busca un cliente u otras búsquedas (se queda congelado buen tiempo).",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion: "No se pueden imprimir los tickets al finalizar la venta; hay que cerrar y volver a buscarlo, pero tarda mucho.",
    estado: "PENDIENTE",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion: "Al tratar de realizar una invalidación, se queda congelado y no lo procesa.",
    estado: "COMPLETADO",
  },
  {
    region: "El Salvador",
    tienda: "TH Metrocentro",
    descripcion: "Si ya una caja está utilizando RPro, la otra caja no le deja ingresar.",
    estado: "PENDIENTE",
  },
  {
    region: "El Salvador",
    tienda: "TH Metrocentro",
    descripcion: "Al realizar el corte Z de un día, les genera el total de tarjeta de un día previo, con efectivo ok.",
    estado: "PENDIENTE",
  },
  {
    region: "El Salvador",
    tienda: null,
    descripcion: "Marcaciones a veces permite realizarla y otras no.",
    estado: "PENDIENTE",
  },

  // Honduras T
  {
    region: "Honduras T",
    tienda: null,
    descripcion: "Si se registra un cliente por medio del QR no carga en sistema (verificado, sigue sin aparecer).",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras T",
    tienda: null,
    descripcion: "Búsqueda de clientes ya registrados.",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras T",
    tienda: null,
    descripcion:
      "Fecha y hora en la factura impresa sale en cero (importante porque nos pueden multar).",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras T",
    tienda: null,
    descripcion: "Búsqueda de clientes ya existentes.",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras T",
    tienda: null,
    descripcion: "Impresiones de factura se ven super pálidas; el Z sale bien (impresos en la misma impresora).",
    estado: "PENDIENTE",
  },

  // Honduras S
  {
    region: "Honduras S",
    tienda: null,
    descripcion:
      "El sistema se encuentra más lento de lo habitual, especialmente al generar un cliente nuevo con código QR. En la mayoría de los casos se queda cargando y no logra traer la información del QR, por lo que se debe registrar de forma manual.",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras S",
    tienda: null,
    descripcion:
      "Las facturas correspondientes a mercadería nueva recién recibida no están apareciendo en el sistema, a pesar de que ya fueron cargadas desde la semana pasada.",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras S",
    tienda: null,
    descripcion:
      "No se está pudiendo realizar correctamente el canje de las Gift Cards. Al procesarlas, el sistema no carga correctamente la información en la central de crédito ni muestra el monto disponible, generando un mensaje de error.",
    estado: "PENDIENTE",
  },
  {
    region: "Honduras S",
    tienda: null,
    descripcion: "El sistema no está generando la impresión del ticket de cambio.",
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
  console.log(`Creados ${created} ítems de seguimiento.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

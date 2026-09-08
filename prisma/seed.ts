/**
 * Seed de datos iniciales:
 *  - Catalogo de checklist (categorias + items), tomado del plan de migracion.
 *  - Usuario administrador por defecto.
 *  - Las 52 tiendas reales extraidas de plan_de_migracion.xlsx.
 *
 * Ejecutar con: npx prisma db seed   (o) npm run prisma:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// -----------------------------------------------------------------------
// Datos reales extraidos de plan_de_migracion.xlsx (hoja "Hoja1")
// -----------------------------------------------------------------------
const STORES_SEED: { pais: string; region: string; tienda: string; horario: string }[] = [
  { pais: "Zona Libre", region: "TH Zona Libre", tienda: "Zona Libre Multimarcas", horario: "4:00AM" },
  { pais: "Zona Libre", region: "TH Zona Libre", tienda: "Zona libre Multibrands", horario: "5:00AM" },
  { pais: "Zona Libre", region: "TH Zona Libre", tienda: "Zona Libre Silverstar", horario: "4:00AM" },
  { pais: "Zona Libre", region: "Zona Libre", tienda: "Zona Libre Zapatos", horario: "5:00AM" },
  { pais: "Zona Libre", region: "CK Panama", tienda: "CK Zonalibre", horario: "4:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Flying Apparel Sur", horario: "12:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Tienda Centro aeropuerto", horario: "12:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Tienda CK Muelle norte", horario: "12:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Karl Lagerfeld", horario: "1:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Bodega Aeropuerto Carga TH", horario: "5:00PM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Bodega Aeropuerto  Plataforma TH", horario: "1:00AM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Bodega Aeropuerto Carga CK", horario: "5:00PM" },
  { pais: "Aeropuerto", region: "Panama Aeropuerto", tienda: "Bodega Aeropuerto  Plataforma CK", horario: "1:00AM" },
  { pais: "Uruguay", region: "CK Uruguay", tienda: "CK Carreta", horario: "2:00AM" },
  { pais: "Uruguay", region: "Uruguay", tienda: "Bodega", horario: "4:00AM" },
  { pais: "Uruguay", region: "CK Uruguay", tienda: "CK Punta del Este", horario: "2:00AM" },
  { pais: "Uruguay", region: "Th Uruguay", tienda: "TH Carreta", horario: "2:00AM" },
  { pais: "Uruguay", region: "Th Uruguay", tienda: "TH Punta del Este", horario: "3:00AM" },
  { pais: "Uruguay", region: "KL Uruguay", tienda: "KL Carreta", horario: "3:00AM" },
  { pais: "Uruguay", region: "KL Uruguay", tienda: "KL Punta del Este", horario: "3:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Metro Mall", horario: "6:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Multicentro", horario: "7:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Albrook Mall Jeans", horario: "6:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Multiplaza", horario: "6:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Albrook Mall Under", horario: "7:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Los Andes", horario: "7:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Altaplaza", horario: "8:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Westland Mall", horario: "8:00AM" },
  { pais: "Panama", region: "CK Panama", tienda: "CK Albrook Bodega", horario: "8:00AM" },
  { pais: "Curacao", region: "CK Curacao", tienda: "Punda", horario: "9:00AM" },
  { pais: "Curacao", region: "Ck Curacao Sambil", tienda: "Sambil", horario: "9:00AM" },
  { pais: "Curacao", region: "TH Curacao", tienda: "Punda", horario: "9:00AM" },
  { pais: "Curacao", region: "TH Curacao Sambil", tienda: "Sambil", horario: "10:00AM" },
  { pais: "Aruba", region: "CK Aruba", tienda: "CK Paseo Herencia", horario: "12:00MD" },
  { pais: "Aruba", region: "CK Aruba", tienda: "CK Lloyd Smith", horario: "12:00MD" },
  { pais: "Aruba", region: "Aruba", tienda: "Royal Plaza", horario: "1:00PM" },
  { pais: "Aruba", region: "Aruba", tienda: "Paseo Herencia", horario: "1:00PM" },
  { pais: "St Maarten", region: "St Maarten", tienda: "St Rose arcade", horario: "11:00AM" },
  { pais: "St Maarten", region: "CK St Rose Arcade", tienda: "Calvin Klein", horario: "11:00AM" },
  { pais: "Belice", region: "TH Belice", tienda: "Belice Frontera", horario: "11:00AM" },
  { pais: "Belice", region: "CK belice", tienda: "Calvin Klein", horario: "12:00MD" },
  { pais: "El salvador", region: "TH El salvador", tienda: "TH Multiplaza", horario: "2:00PM" },
  { pais: "El salvador", region: "TH El salvador", tienda: "Outlet Metrocentro", horario: "2:00PM" },
  { pais: "El salvador", region: "TH El salvador", tienda: "TH Galeria", horario: "2:00PM" },
  { pais: "El salvador", region: "CK El salvador", tienda: "CK Multiplaza", horario: "1:00PM" },
  { pais: "Honduras", region: "CK Honduras", tienda: "CK SPS City Mall", horario: "3:00PM" },
  { pais: "Honduras", region: "CK Honduras", tienda: "CK Teg. City Mall", horario: "3:00PM" },
  { pais: "Honduras", region: "CK Honduras", tienda: "CK Teg. Multiplaza", horario: "3:00PM" },
  { pais: "Honduras", region: "Honduras", tienda: "SPS Multiplaza", horario: "4:00PM" },
  { pais: "Honduras", region: "Honduras", tienda: "SPS City Mall", horario: "4:00PM" },
  { pais: "Honduras", region: "Honduras", tienda: "Teg. Multiplaza", horario: "4:00PM" },
  { pais: "Honduras", region: "Honduras", tienda: "Teg. City Mall", horario: "5:00PM" },
];

// -----------------------------------------------------------------------
// Catalogo de checklist (deducido de las columnas del Excel)
// Nota: la cantidad real de "cajas" varia por tienda -- este catalogo
// cubre el caso general (servidor + 2 cajas). Ajusta/agrega items por
// tienda puntual desde el modulo de administracion una vez en produccion.
// -----------------------------------------------------------------------
const CATEGORIES_SEED = [
  {
    nombre: "Preparación",
    orden: 1,
    items: [
      "Descarga de aplicativos",
      "Verificación de inventario HQ",
      "Verificación de inventario tienda",
      "Backup de base de datos",
    ],
  },
  {
    nombre: "Actualización de equipos",
    orden: 2,
    items: ["Servidor (SVR)", "Caja 1", "Caja 2", "Creación de perfiles de comunicación"],
  },
  {
    nombre: "Prueba de transacción",
    orden: 3,
    items: ["Cliente rápido", "Cambio de moneda", "Compra de empleado", "Factura electrónica"],
  },
  {
    nombre: "Validación final",
    orden: 4,
    items: ["Validación de aplicativos"],
  },
];

function parseHorario(h: string): number {
  const upper = h.trim().toUpperCase();
  const isMD = upper.includes("MD");
  const clean = upper.replace("MD", "PM").replace("AM", "").replace("PM", "");
  const [hhStr, mmStr] = clean.split(":");
  let hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);
  const isPM = upper.includes("PM") || isMD;
  if (hh === 12) hh = isPM ? 12 : 0;
  else if (isPM) hh += 12;
  return hh * 60 + mm;
}

async function main() {
  console.log("Sembrando catalogo de checklist...");
  const categoryIds: Record<string, string> = {};
  const itemDefIds: { id: string; nombre: string }[] = [];

  for (const cat of CATEGORIES_SEED) {
    const category = await prisma.checklistCategory.upsert({
      where: { id: `seed-${cat.orden}` },
      update: {},
      create: { id: `seed-${cat.orden}`, nombre: cat.nombre, orden: cat.orden },
    });
    categoryIds[cat.nombre] = category.id;

    for (let i = 0; i < cat.items.length; i++) {
      const itemNombre = cat.items[i];
      const item = await prisma.checklistItemDef.upsert({
        where: { id: `seed-${cat.orden}-${i}` },
        update: {},
        create: {
          id: `seed-${cat.orden}-${i}`,
          categoryId: category.id,
          nombre: itemNombre,
          orden: i,
        },
      });
      itemDefIds.push({ id: item.id, nombre: item.nombre });
    }
  }

  console.log("Creando usuario administrador por defecto...");
  const defaultPassword = "Admin123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Administrador",
      username: "admin",
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`   -> usuario: admin / contraseña: ${defaultPassword}  (cámbiala apenas ingreses)`);

  console.log("Cargando las 52 tiendas del plan de migración...");
  for (const s of STORES_SEED) {
    const existing = await prisma.store.findFirst({
      where: { tienda: s.tienda, pais: s.pais, horario: s.horario },
    });
    if (existing) continue;

    const store = await prisma.store.create({
      data: {
        pais: s.pais,
        region: s.region,
        tienda: s.tienda,
        horario: s.horario,
        minutosDia: parseHorario(s.horario),
      },
    });

    // Crea el estado de checklist (pendiente) para cada item del catalogo
    await prisma.storeChecklistItem.createMany({
      data: itemDefIds.map((def) => ({
        storeId: store.id,
        itemDefId: def.id,
        completado: false,
      })),
    });
  }

  const total = await prisma.store.count();
  console.log(`Listo. Total de tiendas en base de datos: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

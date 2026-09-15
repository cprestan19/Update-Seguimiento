/**
 * Seed de datos iniciales:
 *  - Un Project ("Migración RPro → Prism 2.4") con su catálogo de checklist.
 *  - Usuario administrador por defecto, miembro ADMIN de ese proyecto.
 *  - Las 49 tiendas reales extraidas de plan_de_migracion.xlsx.
 *
 * Ejecutar con: npx prisma db seed   (o) npm run prisma:seed
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ensureDefaultChecklistCatalog, instantiateChecklistForStore } from "../src/lib/storeChecklist";

const prisma = new PrismaClient();

const PROJECT_NAME = "Migración RPro → Prism 2.4";
const PROJECT_SLUG = "rpro-prism";

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
  { pais: "Uruguay", region: "CK Uruguay", tienda: "CK Punta del Este", horario: "2:00AM" },
  { pais: "Uruguay", region: "Th Uruguay", tienda: "TH Carreta", horario: "2:00AM" },
  { pais: "Uruguay", region: "Th Uruguay", tienda: "TH Punta del Este", horario: "3:00AM" },
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
  console.log("Creando/asegurando el proyecto de la migración...");
  const project = await prisma.project.upsert({
    where: { slug: PROJECT_SLUG },
    update: {},
    create: { name: PROJECT_NAME, slug: PROJECT_SLUG },
  });

  console.log("Sembrando catalogo de checklist del proyecto...");
  await ensureDefaultChecklistCatalog(project.id);

  console.log("Creando usuario administrador por defecto...");
  const defaultPassword = "Admin123!";
  const passwordHash = await bcrypt.hash(defaultPassword, 10);
  const admin = await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: {
      name: "Administrador",
      username: "admin",
      passwordHash,
      lastActiveProjectId: project.id,
    },
  });
  await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: project.id, userId: admin.id } },
    update: {},
    create: { projectId: project.id, userId: admin.id, role: Role.ADMIN },
  });
  console.log(`   -> usuario: admin / contraseña: ${defaultPassword}  (cámbiala apenas ingreses)`);

  console.log("Cargando las 49 tiendas del plan de migración...");
  for (const s of STORES_SEED) {
    const existing = await prisma.store.findFirst({
      where: { projectId: project.id, tienda: s.tienda, pais: s.pais, horario: s.horario },
    });
    if (existing) continue;

    const store = await prisma.store.create({
      data: {
        projectId: project.id,
        pais: s.pais,
        region: s.region,
        tienda: s.tienda,
        horario: s.horario,
        minutosDia: parseHorario(s.horario),
      },
    });

    await instantiateChecklistForStore(store.id, project.id);
  }

  const total = await prisma.store.count({ where: { projectId: project.id } });
  console.log(`Listo. Total de tiendas en el proyecto: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

// Backfill: convierte los datos existentes (single-tenant) en el primer
// Project ("Migración RPro → Prism 2.4"), creando ProjectMember para cada
// usuario actual y asignando projectId a Store/ChecklistCategory/
// SeguimientoItem/AuditLog. Idempotente: se puede correr más de una vez sin
// duplicar el proyecto ni las membresías.
//
// Uso: DATABASE_URL="..." npx tsx scripts/migrate-to-multitenant.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const PROJECT_NAME = "Migración RPro → Prism 2.4";
const PROJECT_SLUG = "rpro-prism";

async function main() {
  const before = {
    stores: await prisma.store.count(),
    seguimientos: await prisma.seguimientoItem.count(),
    usuarios: await prisma.user.count(),
    categorias: await prisma.checklistCategory.count(),
    auditLogs: await prisma.auditLog.count(),
  };
  console.log("Antes:", before);

  const project = await prisma.project.upsert({
    where: { slug: PROJECT_SLUG },
    update: {},
    create: { name: PROJECT_NAME, slug: PROJECT_SLUG },
  });
  console.log(`Proyecto: ${project.name} (${project.id})`);

  const users = await prisma.user.findMany();
  let membresiasCreadas = 0;
  for (const u of users) {
    await prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: project.id, userId: u.id } },
      update: {},
      create: {
        projectId: project.id,
        userId: u.id,
        role: u.role,
        personnelRole: u.personnelRole,
        pais: u.pais,
      },
    });
    membresiasCreadas++;
  }
  console.log(`Membresías aseguradas: ${membresiasCreadas}`);

  const storesUpdated = await prisma.store.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });
  const categoriasUpdated = await prisma.checklistCategory.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });
  const seguimientosUpdated = await prisma.seguimientoItem.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });
  const auditLogsUpdated = await prisma.auditLog.updateMany({
    where: { projectId: null },
    data: { projectId: project.id },
  });
  await prisma.user.updateMany({
    where: { lastActiveProjectId: null },
    data: { lastActiveProjectId: project.id },
  });

  console.log("Backfill aplicado:", {
    stores: storesUpdated.count,
    categorias: categoriasUpdated.count,
    seguimientos: seguimientosUpdated.count,
    auditLogs: auditLogsUpdated.count,
  });

  const after = {
    stores: await prisma.store.count({ where: { projectId: project.id } }),
    seguimientos: await prisma.seguimientoItem.count({ where: { projectId: project.id } }),
    usuarios: await prisma.projectMember.count({ where: { projectId: project.id } }),
    categorias: await prisma.checklistCategory.count({ where: { projectId: project.id } }),
    auditLogs: await prisma.auditLog.count({ where: { projectId: project.id } }),
  };
  console.log("Después (dentro del proyecto):", after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

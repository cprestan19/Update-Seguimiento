// Backfill: crea el primer Departamento (dueño de los Proyectos existentes)
// y le asigna departmentId a todo Project que todavía no tenga uno. Idempotente:
// se puede correr más de una vez sin duplicar el departamento ni reasignar
// proyectos que ya pertenecen a otro departamento.
//
// Uso:
//   DATABASE_URL="..." \
//   DEFAULT_DEPARTMENT_NAME="Nombre del departamento" \
//   DEFAULT_DEPARTMENT_SLUG="slug-del-departamento" \
//   DEFAULT_DEPARTMENT_PASSWORD="contraseña-de-administrador" \
//   npx tsx scripts/migrate-to-departments.ts
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.DEFAULT_DEPARTMENT_NAME;
  const slug = process.env.DEFAULT_DEPARTMENT_SLUG;
  const password = process.env.DEFAULT_DEPARTMENT_PASSWORD;

  if (!name || !slug || !password) {
    console.error(
      "Faltan variables de entorno: DEFAULT_DEPARTMENT_NAME, DEFAULT_DEPARTMENT_SLUG, DEFAULT_DEPARTMENT_PASSWORD"
    );
    process.exit(1);
  }

  const before = {
    proyectosSinDepartamento: await prisma.project.count({ where: { departmentId: null } }),
    departamentos: await prisma.department.count(),
  };
  console.log("Antes:", before);

  let department = await prisma.department.findUnique({ where: { slug } });
  if (!department) {
    const adminPasswordHash = await bcrypt.hash(password, 10);
    department = await prisma.department.create({
      data: { name, slug, adminPasswordHash },
    });
    console.log(`Departamento creado: ${department.name} (${department.id})`);
  } else {
    console.log(`Departamento ya existía: ${department.name} (${department.id})`);
  }

  const proyectosActualizados = await prisma.project.updateMany({
    where: { departmentId: null },
    data: { departmentId: department.id },
  });

  console.log("Backfill aplicado:", { proyectosActualizados: proyectosActualizados.count });

  const after = {
    proyectosSinDepartamento: await prisma.project.count({ where: { departmentId: null } }),
    proyectosEnEsteDepartamento: await prisma.project.count({ where: { departmentId: department.id } }),
  };
  console.log("Después:", after);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

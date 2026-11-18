// Agrega los criterios de la ventana de mantenimiento a la PLANTILLA de un
// proyecto: quedan en todas sus tiendas actuales y en las que se creen después.
// Requiere la migración 20261118000000_add_store_custom_checklist aplicada.
//
// Uso:  npx tsx scripts/add-criterios-mantenimiento.ts [slug-del-proyecto]
// Es idempotente: no duplica criterios que ya existan con el mismo nombre.
import { prisma } from "../src/lib/prisma";
import { addChecklistItem, recalcularTiendas, type ChecklistTipo } from "../src/lib/storeChecklist";

const SLUG = process.argv[2] || "mantenimiento-de-tiendas-panama";
const SECCION = "Mantenimiento";

const CRITERIOS: { nombre: string; tipo: ChecklistTipo }[] = [
  { nombre: "Actualización de Windows", tipo: "CHECK" },
  { nombre: "Actualización de drivers", tipo: "CHECK" },
  { nombre: "Actualización de WebPOS", tipo: "CHECK" },
  { nombre: "Verificación de antenas de robo", tipo: "CHECK" },
  { nombre: "Verificación de grabación de videos", tipo: "CHECK" },
  { nombre: "Tiempo de grabación", tipo: "DATO" },
  { nombre: "Verificación de POS de tarjetas", tipo: "CHECK" },
  { nombre: "Validación de facturas electrónicas", tipo: "CHECK" },
  { nombre: "Entrenamiento de Retail App", tipo: "CHECK" },
  { nombre: "Comentarios extras", tipo: "NOTA" },
];

async function main() {
  const project = await prisma.project.findUnique({ where: { slug: SLUG } });
  if (!project) throw new Error(`No existe el proyecto ${SLUG}`);

  const existentes = await prisma.checklistItemDef.findMany({
    where: { category: { projectId: project.id }, storeId: null, region: null },
    select: { nombre: true },
  });
  const ya = new Set(existentes.map((e) => e.nombre.toLowerCase()));
  const afectadas = new Set<string>();

  for (const c of CRITERIOS) {
    if (ya.has(c.nombre.toLowerCase())) {
      console.log(`  = ya existe: ${c.nombre}`);
      continue;
    }
    const { storeIds } = await addChecklistItem({
      projectId: project.id,
      seccion: SECCION,
      nombre: c.nombre,
      tipo: c.tipo,
      scope: { kind: "PROJECT" },
    });
    storeIds.forEach((s) => afectadas.add(s));
    console.log(`  + ${c.nombre} (${c.tipo}) -> ${storeIds.length} tiendas`);
  }

  await recalcularTiendas([...afectadas]);
  console.log(`Listo: "${project.name}", sección "${SECCION}".`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

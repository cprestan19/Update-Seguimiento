import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKLIST_CATALOG } from "@/lib/defaultChecklistCatalog";
import { recalcularEstadoTienda } from "@/lib/storeStatus";

export const CHECKLIST_TIPOS = ["CHECK", "DATO", "NOTA"] as const;
export type ChecklistTipo = (typeof CHECKLIST_TIPOS)[number];

// Alcance de un criterio:
//   STORE   -> solo una tienda/categoría
//   REGION  -> todas las tiendas de una región del proyecto (actuales y futuras)
//   PROJECT -> plantilla del proyecto: todas sus tiendas (actuales y futuras)
export type ChecklistScope =
  | { kind: "STORE"; storeId: string }
  | { kind: "REGION"; region: string }
  | { kind: "PROJECT" };

// Clona el catálogo por defecto para un proyecto que todavía no tiene
// categorías propias (proyecto recién creado, o el seed local).
export async function ensureDefaultChecklistCatalog(projectId: string) {
  const existing = await prisma.checklistCategory.count({ where: { projectId } });
  if (existing > 0) return;

  for (const cat of DEFAULT_CHECKLIST_CATALOG) {
    await prisma.checklistCategory.create({
      data: {
        projectId,
        nombre: cat.nombre,
        orden: cat.orden,
        items: {
          create: cat.items.map((nombre, i) => ({ nombre, orden: i })),
        },
      },
    });
  }
}

// Instancia el estado de checklist (pendiente) de una tienda nueva: recibe
// los criterios de la plantilla del proyecto y los de su región. Los criterios
// propios de otras tiendas no se copian.
export async function instantiateChecklistForStore(storeId: string, projectId: string) {
  const store = await prisma.store.findUnique({ where: { id: storeId }, select: { region: true } });
  if (!store) return;
  const itemDefs = await prisma.checklistItemDef.findMany({
    where: {
      category: { projectId },
      storeId: null,
      OR: [{ region: null }, { region: { equals: store.region, mode: "insensitive" } }],
    },
    select: { id: true, tipo: true },
  });
  if (itemDefs.length === 0) return;
  await prisma.storeChecklistItem.createMany({
    data: itemDefs.map((def) => ({ storeId, itemDefId: def.id, completado: def.tipo === "NOTA" })),
    skipDuplicates: true,
  });
}

// Tiendas del proyecto a las que aplica un alcance.
async function storesForScope(projectId: string, scope: ChecklistScope): Promise<string[]> {
  if (scope.kind === "STORE") {
    const s = await prisma.store.findFirst({ where: { id: scope.storeId, projectId }, select: { id: true } });
    return s ? [s.id] : [];
  }
  const stores = await prisma.store.findMany({
    where: {
      projectId,
      ...(scope.kind === "REGION" ? { region: { equals: scope.region, mode: "insensitive" as const } } : {}),
    },
    select: { id: true },
  });
  return stores.map((s) => s.id);
}

async function findOrCreateSection(projectId: string, seccion: string) {
  const found = await prisma.checklistCategory.findFirst({
    where: { projectId, nombre: { equals: seccion, mode: "insensitive" } },
  });
  if (found) return found;
  const last = await prisma.checklistCategory.aggregate({ where: { projectId }, _max: { orden: true } });
  return prisma.checklistCategory.create({
    data: { projectId, nombre: seccion, orden: (last._max.orden ?? 0) + 1 },
  });
}

export async function recalcularTiendas(storeIds: string[]) {
  for (const id of storeIds) await recalcularEstadoTienda(id);
}

// Agrega un criterio con el alcance indicado y lo instancia (pendiente) en
// todas las tiendas a las que aplica. Devuelve las tiendas afectadas.
export async function addChecklistItem(params: {
  projectId: string;
  seccion: string;
  nombre: string;
  tipo: ChecklistTipo;
  scope: ChecklistScope;
}) {
  const { projectId, seccion, nombre, tipo, scope } = params;
  const storeIds = await storesForScope(projectId, scope);
  if (scope.kind === "STORE" && storeIds.length === 0) return { def: null, storeIds };

  const category = await findOrCreateSection(projectId, seccion);
  const lastItem = await prisma.checklistItemDef.aggregate({
    where: { categoryId: category.id },
    _max: { orden: true },
  });
  const def = await prisma.checklistItemDef.create({
    data: {
      categoryId: category.id,
      nombre,
      tipo,
      orden: (lastItem._max.orden ?? -1) + 1,
      storeId: scope.kind === "STORE" ? scope.storeId : null,
      region: scope.kind === "REGION" ? scope.region : null,
    },
  });
  if (storeIds.length > 0) {
    await prisma.storeChecklistItem.createMany({
      data: storeIds.map((storeId) => ({ storeId, itemDefId: def.id, completado: tipo === "NOTA" })),
      skipDuplicates: true,
    });
  }
  return { def, storeIds };
}

// Copia la plantilla (criterios de proyecto y de región; nunca los propios de
// una tienda) de un proyecto a otro, sin duplicar criterios que ya existan con
// el mismo nombre en la misma sección. Los copiados se instancian en las
// tiendas existentes del destino. Devuelve cuántos criterios se copiaron.
export async function copyChecklistTemplate(fromProjectId: string, toProjectId: string) {
  const source = await prisma.checklistCategory.findMany({
    where: { projectId: fromProjectId },
    orderBy: { orden: "asc" },
    include: { items: { where: { storeId: null }, orderBy: { orden: "asc" } } },
  });

  let copiados = 0;
  const afectadas = new Set<string>();
  for (const cat of source) {
    if (cat.items.length === 0) continue;
    const target = await findOrCreateSection(toProjectId, cat.nombre);
    const existentes = await prisma.checklistItemDef.findMany({
      where: { categoryId: target.id, storeId: null },
      select: { nombre: true, region: true },
    });
    const key = (n: string, r: string | null) => `${n.toLowerCase()}|${(r || "").toLowerCase()}`;
    const ya = new Set(existentes.map((e) => key(e.nombre, e.region)));

    for (const item of cat.items) {
      if (ya.has(key(item.nombre, item.region))) continue;
      const { storeIds } = await addChecklistItem({
        projectId: toProjectId,
        seccion: target.nombre,
        nombre: item.nombre,
        tipo: item.tipo as ChecklistTipo,
        scope: item.region ? { kind: "REGION", region: item.region } : { kind: "PROJECT" },
      });
      storeIds.forEach((s) => afectadas.add(s));
      copiados++;
    }
  }
  await recalcularTiendas([...afectadas]);
  return copiados;
}

// Borra las secciones del proyecto que quedaron sin ningún criterio.
export async function pruneEmptySections(projectId: string) {
  await prisma.checklistCategory.deleteMany({ where: { projectId, items: { none: {} } } });
}

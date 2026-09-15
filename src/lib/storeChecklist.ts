import { prisma } from "@/lib/prisma";
import { DEFAULT_CHECKLIST_CATALOG } from "@/lib/defaultChecklistCatalog";

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

// Instancia el estado de checklist (pendiente) de una tienda nueva a partir
// del catálogo vigente de su proyecto.
export async function instantiateChecklistForStore(storeId: string, projectId: string) {
  const itemDefs = await prisma.checklistItemDef.findMany({
    where: { category: { projectId } },
    select: { id: true },
  });
  if (itemDefs.length === 0) return;
  await prisma.storeChecklistItem.createMany({
    data: itemDefs.map((def) => ({ storeId, itemDefId: def.id, completado: false })),
  });
}

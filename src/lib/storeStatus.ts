import { prisma } from "@/lib/prisma";

// Recalcula el estado (PENDIENTE/EN_PROGRESO/COMPLETADA) de una tienda a partir
// de su checklist. Los items marcados como "No aplica" se excluyen del total:
// si todos los items aplicables están completos (o no hay ninguno aplicable),
// la tienda se considera completada. No toca el estado si hay una incidencia
// abierta (esa la controla el módulo de incidencias).
export async function recalcularEstadoTienda(storeId: string) {
  const allItems = await prisma.storeChecklistItem.findMany({ where: { storeId } });
  const aplicables = allItems.filter((i) => !i.noAplica);
  const total = aplicables.length;
  const done = aplicables.filter((i) => i.completado).length;

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    include: { incidents: { where: { resuelta: false } } },
  });
  if (!store) return;

  const tieneIncidenciaAbierta = store.incidents.length > 0;
  if (tieneIncidenciaAbierta) return;

  let nuevoEstado = store.estado;
  let inicioReal = store.inicioReal;
  let finReal = store.finReal;
  let duracionRealMin = store.duracionRealMin;

  if (total === 0 || done === total) {
    nuevoEstado = "COMPLETADA";
    finReal = finReal ?? new Date();
    if (inicioReal) {
      duracionRealMin = Math.round((finReal.getTime() - inicioReal.getTime()) / 60000);
    }
  } else if (done === 0) {
    nuevoEstado = "PENDIENTE";
    inicioReal = null;
    finReal = null;
    duracionRealMin = null;
  } else {
    nuevoEstado = "EN_PROGRESO";
    if (!inicioReal) inicioReal = new Date();
  }

  await prisma.store.update({
    where: { id: storeId },
    data: { estado: nuevoEstado, inicioReal, finReal, duracionRealMin },
  });
}

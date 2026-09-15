// Catálogo de checklist por defecto que se clona para cada proyecto nuevo
// (y que usa el seed para el proyecto de la migración RPro -> Prism).
export const DEFAULT_CHECKLIST_CATALOG: { nombre: string; orden: number; items: string[] }[] = [
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

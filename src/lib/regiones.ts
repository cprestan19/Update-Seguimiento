// Lista de regiones sugeridas al crear una categoría en cualquier proyecto
// (no específica de la migración RPro). Si la región deseada no está en la
// lista, se puede escribir manualmente con la opción "Otra".
export const REGIONES_DISPONIBLES = [
  "Panamá",
  "Zona Libre",
  "Aeropuerto",
  "Uruguay",
  "El Salvador",
  "Honduras",
  "Curazao",
  "Aruba",
  "St. Maarten",
  "Belice",
  "Colombia",
  "Guatemala",
  "República Dominicana",
].sort((a, b) => a.localeCompare(b, "es"));

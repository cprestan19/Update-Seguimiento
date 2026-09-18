import {
  ESTADOS_ORDENADOS,
  PRIORIDADES_ORDENADAS,
  TIPOS_ORDENADOS,
  AREAS_ORDENADAS,
  IMPACTOS_ORDENADOS,
  RIESGOS_ORDENADOS,
  ALCANCES_ORDENADOS,
} from "@/lib/requirementLabels";

export function esEnumValido<T extends string>(valores: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (valores as readonly string[]).includes(v);
}

export function validarEstado(v: unknown) {
  return esEnumValido(ESTADOS_ORDENADOS, v);
}
export function validarPrioridad(v: unknown) {
  return esEnumValido(PRIORIDADES_ORDENADAS, v);
}
export function validarTipo(v: unknown) {
  return esEnumValido(TIPOS_ORDENADOS, v);
}
export function validarArea(v: unknown) {
  return esEnumValido(AREAS_ORDENADAS, v);
}
export function validarImpacto(v: unknown) {
  return esEnumValido(IMPACTOS_ORDENADOS, v);
}
export function validarRiesgo(v: unknown) {
  return esEnumValido(RIESGOS_ORDENADOS, v);
}
export function validarAlcanceAfectados(v: unknown) {
  return esEnumValido(ALCANCES_ORDENADOS, v);
}

export function parseFechaValida(v: unknown): Date | null {
  if (!v || typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Mapas de etiquetas/colores compartidos entre la lista, el detalle y el
// widget del dashboard de Requerimientos (3 consumidores — a diferencia de
// Kpi() u otros componentes chicos que el resto de la app sí redeclara por
// página, estos vale la pena centralizarlos).

export const ESTADO_LABEL: Record<string, string> = {
  SOLICITUD: "Solicitud",
  ANALISIS: "Análisis",
  APROBADO: "Aprobado",
  EN_DESARROLLO: "En desarrollo",
  EN_IMPLEMENTACION: "En implementación",
  EN_PRUEBAS: "En pruebas",
  EN_PAUSA: "En pausa",
  IMPLEMENTADO: "Implementado",
  CERRADO: "Cerrado",
  CANCELADO: "Cancelado",
};

export const ESTADO_BADGE: Record<string, string> = {
  SOLICITUD: "bg-panel2 text-muted border border-border",
  ANALISIS: "bg-blueDim text-blue",
  APROBADO: "bg-blueDim text-blue",
  EN_DESARROLLO: "bg-blueDim text-blue",
  EN_IMPLEMENTACION: "bg-blueDim text-blue",
  EN_PRUEBAS: "bg-amberDim text-amber",
  EN_PAUSA: "bg-panel2 text-muted border border-border",
  IMPLEMENTADO: "bg-tealDim text-teal",
  CERRADO: "bg-tealDim text-teal",
  CANCELADO: "bg-redDim text-red",
};

export const PRIORIDAD_LABEL: Record<string, string> = {
  CRITICA: "Crítica",
  ALTA: "Alta",
  MEDIA: "Media",
  BAJA: "Baja",
};

export const PRIORIDAD_BADGE: Record<string, string> = {
  CRITICA: "bg-redDim text-red",
  ALTA: "bg-amberDim text-amber",
  MEDIA: "bg-blueDim text-blue",
  BAJA: "bg-panel2 text-muted border border-border",
};

export const TIPO_LABEL: Record<string, string> = {
  NUEVO_DESARROLLO: "Nuevo desarrollo",
  MEJORA: "Mejora",
  ACTUALIZACION: "Actualización",
};

export const AREA_LABEL: Record<string, string> = {
  DESARROLLO: "Desarrollo",
  IMPLEMENTACION: "Implementación",
  INFRAESTRUCTURA: "Infraestructura",
  REDES: "Redes",
  SEGURIDAD: "Seguridad",
  INTEGRACION: "Integración",
  MIGRACION: "Migración",
  SOPORTE: "Soporte",
  MANTENIMIENTO: "Mantenimiento",
  OTRO: "Otro",
};

export const IMPACTO_LABEL: Record<string, string> = {
  SIN_IMPACTO: "Sin impacto",
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
  CRITICO: "Crítico",
};

export const RIESGO_LABEL: Record<string, string> = {
  BAJO: "Bajo",
  MEDIO: "Medio",
  ALTO: "Alto",
};

export const ALCANCE_AFECTADOS_LABEL: Record<string, string> = {
  USUARIO: "Usuario",
  DEPARTAMENTO: "Departamento",
  TIENDA: "Tienda",
  PAIS: "País",
  REGION: "Región",
  ORGANIZACION: "Toda la organización",
};

export const SLA_DOT: Record<string, string> = {
  green: "bg-teal",
  amber: "bg-amber",
  red: "bg-red",
  gray: "bg-muted2",
};

export const SLA_TEXT: Record<string, string> = {
  green: "text-teal",
  amber: "text-amber",
  red: "text-red",
  gray: "text-muted",
};

export const ACTIVITY_TIPO_LABEL: Record<string, string> = {
  COMENTARIO: "Comentario",
  ACTIVIDAD: "Actividad",
  CREACION: "Creación",
  EDICION: "Edición",
  CAMBIO_ESTADO: "Cambio de estado",
  CAMBIO_RESPONSABLE: "Cambio de responsable",
  CAMBIO_PRIORIDAD: "Cambio de prioridad",
  FECHA_MODIFICADA: "Fecha modificada",
  CIERRE: "Cierre",
  ELIMINACION: "Eliminación",
};

export const ESTADOS_ORDENADOS = [
  "SOLICITUD",
  "ANALISIS",
  "APROBADO",
  "EN_DESARROLLO",
  "EN_IMPLEMENTACION",
  "EN_PRUEBAS",
  "EN_PAUSA",
  "IMPLEMENTADO",
  "CERRADO",
  "CANCELADO",
] as const;

export const PRIORIDADES_ORDENADAS = ["CRITICA", "ALTA", "MEDIA", "BAJA"] as const;
export const TIPOS_ORDENADOS = ["NUEVO_DESARROLLO", "MEJORA", "ACTUALIZACION"] as const;
export const AREAS_ORDENADAS = [
  "DESARROLLO",
  "IMPLEMENTACION",
  "INFRAESTRUCTURA",
  "REDES",
  "SEGURIDAD",
  "INTEGRACION",
  "MIGRACION",
  "SOPORTE",
  "MANTENIMIENTO",
  "OTRO",
] as const;
export const IMPACTOS_ORDENADOS = ["SIN_IMPACTO", "BAJO", "MEDIO", "ALTO", "CRITICO"] as const;
export const RIESGOS_ORDENADOS = ["BAJO", "MEDIO", "ALTO"] as const;
export const ALCANCES_ORDENADOS = ["USUARIO", "DEPARTAMENTO", "TIENDA", "PAIS", "REGION", "ORGANIZACION"] as const;

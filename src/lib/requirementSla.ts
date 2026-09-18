// Indicador visual de SLA para un Requirement. Se calcula siempre al leer
// (nunca se persiste) y nunca modifica el campo 'estado' — es solo apoyo
// visual, tal como se pidio explicitamente.

const MS_DIA = 24 * 60 * 60 * 1000;
const UMBRAL_PROXIMO_DIAS = 3;

const ESTADOS_CERRADOS = new Set(["IMPLEMENTADO", "CERRADO", "CANCELADO"]);

export type SlaColor = "green" | "amber" | "red" | "gray";

export type SlaInfo = {
  color: SlaColor;
  label: string;
  diasRestantes: number | null; // null si ya tiene fecha real de entrega
  diasAtraso: number | null;
  vencido: boolean;
  proximoAVencer: boolean;
};

function diffDias(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / MS_DIA);
}

export function calcularSla(
  fechaEstimadaEntrega: Date,
  fechaRealEntrega: Date | null,
  estado: string,
  now: Date = new Date()
): SlaInfo {
  if (fechaRealEntrega) {
    const diasAtraso = Math.max(0, diffDias(fechaEstimadaEntrega, fechaRealEntrega));
    if (diasAtraso > 0) {
      return {
        color: "amber",
        label: `Entregado con ${diasAtraso} día${diasAtraso === 1 ? "" : "s"} de atraso`,
        diasRestantes: null,
        diasAtraso,
        vencido: false,
        proximoAVencer: false,
      };
    }
    return {
      color: "green",
      label: "Entregado en tiempo",
      diasRestantes: null,
      diasAtraso: 0,
      vencido: false,
      proximoAVencer: false,
    };
  }

  if (ESTADOS_CERRADOS.has(estado)) {
    return {
      color: "gray",
      label: "Cerrado sin fecha real registrada",
      diasRestantes: null,
      diasAtraso: null,
      vencido: false,
      proximoAVencer: false,
    };
  }

  const dias = diffDias(now, fechaEstimadaEntrega);
  if (dias < 0) {
    const atraso = Math.abs(dias);
    return {
      color: "red",
      label: `${atraso} día${atraso === 1 ? "" : "s"} atrasado`,
      diasRestantes: null,
      diasAtraso: atraso,
      vencido: true,
      proximoAVencer: false,
    };
  }
  if (dias <= UMBRAL_PROXIMO_DIAS) {
    return {
      color: "amber",
      label: dias === 0 ? "Vence hoy" : `Vence en ${dias} día${dias === 1 ? "" : "s"}`,
      diasRestantes: dias,
      diasAtraso: null,
      vencido: false,
      proximoAVencer: true,
    };
  }
  return {
    color: "green",
    label: `Vence en ${dias} días`,
    diasRestantes: dias,
    diasAtraso: null,
    vencido: false,
    proximoAVencer: false,
  };
}

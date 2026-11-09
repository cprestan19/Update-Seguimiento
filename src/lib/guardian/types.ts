import type { GuardianScanType, GuardianSeverity } from "@prisma/client";

// Un hallazgo producido por un escáner, antes de persistirse. El motor lo
// convierte luego en filas GuardianFinding.
export type RawFinding = {
  type: GuardianScanType;
  severity: GuardianSeverity;
  title: string;
  description: string;
  location?: string;
  evidence?: string;
  recommendation?: string;
  cwe?: string;
  owasp?: string;
};

export const SEVERITY_ORDER: GuardianSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];

export function sortFindings(a: RawFinding, b: RawFinding): number {
  return SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity);
}

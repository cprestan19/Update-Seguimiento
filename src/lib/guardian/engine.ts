import { prisma } from "@/lib/prisma";
import type { GuardianScanType } from "@prisma/client";
import { scanUrlExposure, scanUrlHeaders } from "./urlScanner";
import { scanRepoDeps, scanRepoSast, scanRepoSecrets } from "./repoScanner";
import type { RawFinding } from "./types";

// Tipos de escaneo que son intrusivos / van más allá de la portada pública y
// por tanto EXIGEN que el objetivo esté verificado o autorizado.
const REQUIRES_AUTHORIZATION: GuardianScanType[] = ["URL_EXPOSURE"];

export function scanTypeRequiresAuthorization(type: GuardianScanType): boolean {
  return REQUIRES_AUTHORIZATION.includes(type);
}

// Ejecuta un escaneo ya creado (status QUEUED) de principio a fin. Está pensado
// para llamarse de forma asíncrona tras crear la fila; actualiza estado,
// hallazgos y conteos. No lanza: cualquier error se guarda en el registro.
export async function runScan(scanId: string): Promise<void> {
  const scan = await prisma.guardianScan.findUnique({
    where: { id: scanId },
    include: { target: true },
  });
  if (!scan) return;
  const { target } = scan;

  await prisma.guardianScan.update({
    where: { id: scanId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const authorized = target.verification === "VERIFIED" || target.verification === "AUTHORIZED";
  const findings: RawFinding[] = [];

  try {
    for (const type of scan.types) {
      // Barrera de autorización: nunca ejecutar pruebas intrusivas sin permiso.
      if (scanTypeRequiresAuthorization(type) && !authorized) {
        findings.push({
          type,
          severity: "INFO",
          title: "Prueba omitida por falta de autorización",
          description: `La prueba ${type} solo se ejecuta contra objetivos verificados o autorizados. Verifica la propiedad del dominio o registra la autorización.`,
        });
        continue;
      }

      switch (type) {
        case "URL_HEADERS":
          findings.push(...(await scanUrlHeaders(target.url)));
          break;
        case "URL_EXPOSURE":
          findings.push(...(await scanUrlExposure(target.url)));
          break;
        case "REPO_DEPS":
          findings.push(...(await scanRepoDeps(target.url)));
          break;
        case "REPO_SECRETS":
          findings.push(...(await scanRepoSecrets(target.url)));
          break;
        case "REPO_SAST":
          findings.push(...(await scanRepoSast(target.url)));
          break;
        case "REPO_CONFIG":
          // Reservado para una fase posterior.
          break;
      }
    }

    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
    for (const f of findings) counts[f.severity]++;

    await prisma.$transaction([
      prisma.guardianFinding.createMany({
        data: findings.map((f) => ({
          scanId,
          type: f.type,
          severity: f.severity,
          title: f.title,
          description: f.description,
          location: f.location,
          evidence: f.evidence,
          recommendation: f.recommendation,
          cwe: f.cwe,
          owasp: f.owasp,
        })),
      }),
      prisma.guardianScan.update({
        where: { id: scanId },
        data: {
          status: "DONE",
          finishedAt: new Date(),
          countCritical: counts.CRITICAL,
          countHigh: counts.HIGH,
          countMedium: counts.MEDIUM,
          countLow: counts.LOW,
          countInfo: counts.INFO,
        },
      }),
    ]);
  } catch (err) {
    await prisma.guardianScan.update({
      where: { id: scanId },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: err instanceof Error ? err.message.slice(0, 500) : "Error desconocido",
      },
    });
  }
}

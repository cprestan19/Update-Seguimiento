import { assertPublicUrl } from "./ssrfGuard";
import { getDefaultBranch, getFileContent, getTree, parseGitHubUrl, type RepoRef, type TreeEntry } from "./github";
import type { RawFinding } from "./types";

// ---------------------------------------------------------------------------
// SCA: dependencias vulnerables, consultando OSV.dev (base libre y abierta).
// ---------------------------------------------------------------------------

type OsvVuln = { id: string; summary?: string; severity?: { type: string; score: string }[] };

function cleanVersion(range: string): string | null {
  const m = range.match(/\d+\.\d+\.\d+([-.][0-9A-Za-z.]+)?/);
  return m ? m[0] : null;
}

function osvSeverity(v: OsvVuln): RawFinding["severity"] {
  const cvss = v.severity?.find((s) => s.type.startsWith("CVSS"));
  if (cvss) {
    const score = parseFloat(cvss.score);
    if (!Number.isNaN(score)) {
      if (score >= 9) return "CRITICAL";
      if (score >= 7) return "HIGH";
      if (score >= 4) return "MEDIUM";
      return "LOW";
    }
  }
  return "MEDIUM";
}

export async function scanRepoDeps(repoUrl: string): Promise<RawFinding[]> {
  const ref = parseGitHubUrl(repoUrl);
  if (!ref) return [{ type: "REPO_DEPS", severity: "INFO", title: "No es un repositorio de GitHub soportado", description: "El análisis de dependencias v1 soporta repositorios públicos de GitHub." }];

  const branch = await getDefaultBranch(ref);
  if (!branch) return [{ type: "REPO_DEPS", severity: "INFO", title: "No se pudo leer el repositorio", description: "El repositorio no existe, es privado, o se agotó el límite de la API de GitHub (define GITHUB_TOKEN)." }];

  const tree = await getTree(ref, branch);
  const pkgFiles = tree.filter((e) => e.path.endsWith("package.json") && !e.path.includes("node_modules")).slice(0, 5);
  if (pkgFiles.length === 0) {
    return [{ type: "REPO_DEPS", severity: "INFO", title: "Sin package.json", description: "No se encontraron manifiestos npm. v1 analiza ecosistema npm." }];
  }

  const queries: { package: { name: string; ecosystem: string }; version: string; _loc: string }[] = [];
  for (const f of pkgFiles) {
    const content = await getFileContent(ref, branch, f.path);
    if (!content) continue;
    try {
      const pkg = JSON.parse(content) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      for (const [name, range] of Object.entries({ ...pkg.dependencies, ...pkg.devDependencies })) {
        const version = cleanVersion(range);
        if (version) queries.push({ package: { name, ecosystem: "npm" }, version, _loc: f.path });
      }
    } catch {
      // manifiesto ilegible
    }
  }

  if (queries.length === 0) return [];

  // OSV querybatch
  const check = await assertPublicUrl("https://api.osv.dev/v1/querybatch");
  if (!check.ok) return [];
  let batchRes: Response;
  try {
    batchRes = await fetch("https://api.osv.dev/v1/querybatch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "GuardianToolsIT/1.0" },
      body: JSON.stringify({ queries: queries.map((q) => ({ package: q.package, version: q.version })) }),
    });
  } catch {
    return [{ type: "REPO_DEPS", severity: "INFO", title: "No se pudo consultar OSV", description: "Fallo al contactar la base de vulnerabilidades OSV.dev." }];
  }
  if (!batchRes.ok) return [];

  const { results } = (await batchRes.json()) as { results: { vulns?: { id: string }[] }[] };
  const findings: RawFinding[] = [];

  // Para cada paquete con vulnerabilidades, pedir el detalle (limitado).
  for (let i = 0; i < results.length; i++) {
    const vulns = results[i]?.vulns;
    if (!vulns || vulns.length === 0) continue;
    const q = queries[i];
    const details: OsvVuln[] = [];
    for (const v of vulns.slice(0, 3)) {
      try {
        const dRes = await fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(v.id)}`, { headers: { "User-Agent": "GuardianToolsIT/1.0" } });
        if (dRes.ok) details.push((await dRes.json()) as OsvVuln);
      } catch {
        // seguir
      }
    }
    const worst = details.reduce<RawFinding["severity"]>((acc, d) => {
      const s = osvSeverity(d);
      const order = ["INFO", "LOW", "MEDIUM", "HIGH", "CRITICAL"];
      return order.indexOf(s) > order.indexOf(acc) ? s : acc;
    }, "MEDIUM");

    findings.push({
      type: "REPO_DEPS",
      severity: worst,
      title: `Dependencia vulnerable: ${q.package.name}@${q.version}`,
      description: `${vulns.length} vulnerabilidad(es) conocidas. ${details.map((d) => `${d.id}: ${d.summary ?? ""}`).join(" | ").slice(0, 400)}`,
      location: q._loc,
      evidence: vulns.map((v) => v.id).join(", "),
      recommendation: `Actualiza ${q.package.name} a una versión sin vulnerabilidades conocidas.`,
      owasp: "A06:2021 Vulnerable and Outdated Components",
      cwe: "CWE-1104",
    });
  }

  return findings;
}

// ---------------------------------------------------------------------------
// Secretos hardcodeados
// ---------------------------------------------------------------------------

const SECRET_RULES: { name: string; re: RegExp; severity: RawFinding["severity"] }[] = [
  { name: "Clave privada", re: /-----BEGIN (RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/, severity: "CRITICAL" },
  { name: "AWS Access Key", re: /AKIA[0-9A-Z]{16}/, severity: "CRITICAL" },
  { name: "Token de GitHub", re: /gh[pousr]_[0-9A-Za-z]{36,}/, severity: "CRITICAL" },
  { name: "Token de Slack", re: /xox[baprs]-[0-9A-Za-z-]{10,}/, severity: "HIGH" },
  { name: "Clave de Google API", re: /AIza[0-9A-Za-z_-]{35}/, severity: "HIGH" },
  { name: "Clave secreta de Stripe", re: /sk_live_[0-9A-Za-z]{24,}/, severity: "CRITICAL" },
  { name: "URL de BD con contraseña", re: /(postgres|postgresql|mysql|mongodb(\+srv)?):\/\/[^:@\s]+:[^@\s]+@/, severity: "HIGH" },
  { name: "JWT", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, severity: "MEDIUM" },
];

const SCANNABLE = /\.(ts|tsx|js|jsx|mjs|cjs|json|env|ya?ml|txt|md|py|rb|go|java|php|sh|xml|properties|config)$/i;
const SKIP = /(^|\/)(node_modules|dist|build|\.next|vendor|\.git)\//;

function redact(line: string): string {
  return line.length > 160 ? line.slice(0, 80) + "…[recortado]" : line;
}

export async function scanRepoSecrets(repoUrl: string, maxFiles = 60): Promise<RawFinding[]> {
  const ref = parseGitHubUrl(repoUrl);
  if (!ref) return [];
  const branch = await getDefaultBranch(ref);
  if (!branch) return [];
  const tree = await getTree(ref, branch);

  const candidates = tree
    .filter((e) => SCANNABLE.test(e.path) && !SKIP.test("/" + e.path) && (e.size ?? 0) < 300_000)
    .slice(0, maxFiles);

  const findings: RawFinding[] = [];
  for (const f of candidates) {
    const content = await getFileContent(ref, branch, f.path);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const rule of SECRET_RULES) {
        if (rule.re.test(lines[i])) {
          findings.push({
            type: "REPO_SECRETS",
            severity: rule.severity,
            title: `Posible secreto en código: ${rule.name}`,
            description: `Se detectó un patrón de ${rule.name} en el repositorio. Verifícalo y, si es real, rótalo de inmediato.`,
            location: `${f.path}:${i + 1}`,
            evidence: redact(lines[i].trim()),
            recommendation: "Mueve el secreto a variables de entorno, rótalo y purga el historial si fue commiteado.",
            owasp: "A07:2021 Identification and Authentication Failures",
            cwe: "CWE-798",
          });
        }
      }
    }
  }
  return findings;
}

// ---------------------------------------------------------------------------
// SAST ligero: patrones de código inseguro (heurístico, para triaje humano)
// ---------------------------------------------------------------------------

const SAST_RULES: { name: string; re: RegExp; severity: RawFinding["severity"]; rec: string; cwe: string }[] = [
  { name: "Uso de eval()", re: /\beval\s*\(/, severity: "HIGH", rec: "Evita eval(); usa alternativas seguras de parseo.", cwe: "CWE-95" },
  { name: "child_process con concatenación", re: /exec(Sync)?\s*\(\s*[`'"][^`'"]*\$\{/, severity: "HIGH", rec: "Usa execFile con argumentos en array; nunca concatenes entrada del usuario.", cwe: "CWE-78" },
  { name: "dangerouslySetInnerHTML", re: /dangerouslySetInnerHTML/, severity: "MEDIUM", rec: "Sanea el HTML (p.ej. DOMPurify) antes de inyectarlo.", cwe: "CWE-79" },
  { name: "SQL por concatenación", re: /(query|execute)\s*\(\s*[`'"][^`'"]*(SELECT|INSERT|UPDATE|DELETE)[^`'"]*\$\{/i, severity: "HIGH", rec: "Usa consultas parametrizadas / un ORM.", cwe: "CWE-89" },
  { name: "TLS deshabilitado", re: /rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*['\"]?0/, severity: "HIGH", rec: "No desactives la verificación de certificados TLS.", cwe: "CWE-295" },
  { name: "Hash débil (MD5/SHA1)", re: /createHash\s*\(\s*['"](md5|sha1)['"]/i, severity: "MEDIUM", rec: "Usa SHA-256+ o bcrypt/argon2 para contraseñas.", cwe: "CWE-327" },
  { name: "Math.random para seguridad", re: /Math\.random\s*\(\)/, severity: "LOW", rec: "Para tokens/secretos usa crypto.randomBytes.", cwe: "CWE-338" },
];

const CODE_FILE = /\.(ts|tsx|js|jsx|mjs|cjs|py|rb|go|java|php)$/i;

export async function scanRepoSast(repoUrl: string, maxFiles = 60): Promise<RawFinding[]> {
  const ref = parseGitHubUrl(repoUrl);
  if (!ref) return [];
  const branch = await getDefaultBranch(ref);
  if (!branch) return [];
  const tree = await getTree(ref, branch);

  const candidates = tree
    .filter((e) => CODE_FILE.test(e.path) && !SKIP.test("/" + e.path) && (e.size ?? 0) < 300_000)
    .slice(0, maxFiles);

  const findings: RawFinding[] = [];
  for (const f of candidates) {
    const content = await getFileContent(ref, branch, f.path);
    if (!content) continue;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith("//") || lines[i].trim().startsWith("*")) continue;
      for (const rule of SAST_RULES) {
        if (rule.re.test(lines[i])) {
          findings.push({
            type: "REPO_SAST",
            severity: rule.severity,
            title: `Patrón inseguro: ${rule.name}`,
            description: `Heurística SAST detectó "${rule.name}". Requiere revisión humana para confirmar explotabilidad.`,
            location: `${f.path}:${i + 1}`,
            evidence: redact(lines[i].trim()),
            recommendation: rule.rec,
            owasp: "A03:2021 Injection",
            cwe: rule.cwe,
          });
        }
      }
    }
  }
  return findings;
}

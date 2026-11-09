import { safeFetch } from "./ssrfGuard";
import type { RawFinding } from "./types";

// Escáner de URL. Dos niveles:
//  - URL_HEADERS (perfil SAFE): una sola petición a la portada, inspecciona
//    cabeceras de seguridad, cookies y uso de TLS. No es intrusivo.
//  - URL_EXPOSURE (perfil FULL): prueba rutas sensibles (.env, .git, backups).
//    Solo se ejecuta contra objetivos verificados/autorizados — eso lo decide
//    el motor, no este módulo.

type HeaderRule = {
  header: string;
  severity: RawFinding["severity"];
  title: string;
  recommendation: string;
  owasp?: string;
  cwe?: string;
};

const HEADER_RULES: HeaderRule[] = [
  {
    header: "content-security-policy",
    severity: "MEDIUM",
    title: "Falta Content-Security-Policy",
    recommendation: "Define una CSP restrictiva para mitigar XSS e inyección de contenido.",
    owasp: "A05:2021 Security Misconfiguration",
    cwe: "CWE-693",
  },
  {
    header: "strict-transport-security",
    severity: "MEDIUM",
    title: "Falta Strict-Transport-Security (HSTS)",
    recommendation: "Añade HSTS con max-age de al menos 6 meses para forzar HTTPS.",
    owasp: "A05:2021 Security Misconfiguration",
    cwe: "CWE-319",
  },
  {
    header: "x-frame-options",
    severity: "LOW",
    title: "Falta X-Frame-Options / frame-ancestors",
    recommendation: "Usa X-Frame-Options: DENY o CSP frame-ancestors 'none' para evitar clickjacking.",
    owasp: "A05:2021 Security Misconfiguration",
    cwe: "CWE-1021",
  },
  {
    header: "x-content-type-options",
    severity: "LOW",
    title: "Falta X-Content-Type-Options",
    recommendation: "Añade X-Content-Type-Options: nosniff.",
    owasp: "A05:2021 Security Misconfiguration",
    cwe: "CWE-16",
  },
  {
    header: "referrer-policy",
    severity: "INFO",
    title: "Falta Referrer-Policy",
    recommendation: "Añade Referrer-Policy: strict-origin-when-cross-origin.",
    owasp: "A05:2021 Security Misconfiguration",
  },
];

export async function scanUrlHeaders(baseUrl: string): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const result = await safeFetch(baseUrl, { method: "GET" });

  if ("error" in result) {
    findings.push({
      type: "URL_HEADERS",
      severity: "INFO",
      title: "No se pudo conectar al objetivo",
      description: `Guardian no pudo obtener la portada: ${result.error}`,
    });
    return findings;
  }

  const { res, finalUrl } = result;
  const h = res.headers;

  // HTTP sin cifrar
  if (finalUrl.startsWith("http://")) {
    findings.push({
      type: "URL_HEADERS",
      severity: "HIGH",
      title: "El sitio responde por HTTP sin cifrar",
      description: "El tráfico viaja sin TLS; es interceptable y manipulable.",
      location: finalUrl,
      recommendation: "Redirige todo a HTTPS y activa HSTS.",
      owasp: "A02:2021 Cryptographic Failures",
      cwe: "CWE-319",
    });
  }

  for (const rule of HEADER_RULES) {
    if (!h.get(rule.header)) {
      findings.push({
        type: "URL_HEADERS",
        severity: rule.severity,
        title: rule.title,
        description: `La respuesta de ${finalUrl} no incluye la cabecera ${rule.header}.`,
        location: finalUrl,
        recommendation: rule.recommendation,
        owasp: rule.owasp,
        cwe: rule.cwe,
      });
    }
  }

  // Divulgación de tecnología/versión
  for (const banner of ["server", "x-powered-by", "x-aspnet-version"]) {
    const val = h.get(banner);
    if (val) {
      findings.push({
        type: "URL_HEADERS",
        severity: "INFO",
        title: `Divulgación de tecnología en cabecera ${banner}`,
        description: `La cabecera ${banner} revela "${val}", útil para un atacante.`,
        location: finalUrl,
        evidence: `${banner}: ${val}`,
        recommendation: "Elimina u ofusca las cabeceras que revelan la pila tecnológica.",
        owasp: "A05:2021 Security Misconfiguration",
      });
    }
  }

  // Flags de cookies
  const setCookie = h.get("set-cookie");
  if (setCookie) {
    const low = setCookie.toLowerCase();
    const missing: string[] = [];
    if (!low.includes("secure")) missing.push("Secure");
    if (!low.includes("httponly")) missing.push("HttpOnly");
    if (!low.includes("samesite")) missing.push("SameSite");
    if (missing.length) {
      findings.push({
        type: "URL_HEADERS",
        severity: "MEDIUM",
        title: `Cookies sin atributos de seguridad: ${missing.join(", ")}`,
        description: "Una o más cookies carecen de atributos que protegen contra robo de sesión y CSRF.",
        location: finalUrl,
        recommendation: "Marca las cookies de sesión como Secure, HttpOnly y SameSite=Lax o Strict.",
        owasp: "A05:2021 Security Misconfiguration",
        cwe: "CWE-614",
      });
    }
  }

  return findings;
}

// Rutas sensibles que NO deberían ser accesibles públicamente.
const EXPOSURE_PATHS: { path: string; title: string; severity: RawFinding["severity"]; needle?: RegExp }[] = [
  { path: "/.env", title: "Archivo .env expuesto", severity: "CRITICAL", needle: /[A-Z_]+=/ },
  { path: "/.git/HEAD", title: "Repositorio .git expuesto", severity: "HIGH", needle: /ref:\s*refs\// },
  { path: "/.git/config", title: "Configuración .git expuesta", severity: "HIGH", needle: /\[core\]/ },
  { path: "/config.json", title: "config.json accesible", severity: "MEDIUM" },
  { path: "/backup.zip", title: "Backup accesible", severity: "HIGH" },
  { path: "/.DS_Store", title: ".DS_Store expuesto", severity: "LOW" },
  { path: "/phpinfo.php", title: "phpinfo() accesible", severity: "MEDIUM", needle: /phpinfo\(\)/i },
  { path: "/server-status", title: "Apache server-status accesible", severity: "MEDIUM" },
];

export async function scanUrlExposure(baseUrl: string): Promise<RawFinding[]> {
  const findings: RawFinding[] = [];
  const base = baseUrl.replace(/\/+$/, "");

  for (const probe of EXPOSURE_PATHS) {
    const result = await safeFetch(`${base}${probe.path}`, { method: "GET", maxRedirects: 0 });
    if ("error" in result) continue;
    const { res, body, finalUrl } = result;
    if (res.status !== 200) continue;
    // Si se definió un patrón, confirmar que el contenido es realmente el esperado
    // (evita falsos positivos de páginas 200 "catch-all").
    if (probe.needle && !probe.needle.test(body)) continue;

    findings.push({
      type: "URL_EXPOSURE",
      severity: probe.severity,
      title: probe.title,
      description: `La ruta ${probe.path} responde 200 y parece exponer contenido sensible.`,
      location: finalUrl,
      evidence: body.slice(0, 200),
      recommendation: "Bloquea el acceso público a este recurso en el servidor/CDN.",
      owasp: "A05:2021 Security Misconfiguration",
      cwe: "CWE-538",
    });
  }

  return findings;
}

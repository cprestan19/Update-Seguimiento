import { lookup } from "dns/promises";
import net from "net";

// Guardia anti-SSRF. Guardian hace peticiones del lado del servidor a URLs que
// escribe el usuario; sin este control, un objetivo podría apuntar a la red
// interna o al endpoint de metadatos de la nube (169.254.169.254) y filtrar
// credenciales. Toda petición saliente de Guardian pasa por aquí.

export type UrlCheck = { ok: true; url: URL } | { ok: false; reason: string };

// Rangos privados / reservados que nunca deben alcanzarse.
function isForbiddenIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const p = ip.split(".").map(Number);
    if (p[0] === 10) return true; // 10.0.0.0/8
    if (p[0] === 127) return true; // loopback
    if (p[0] === 0) return true; // 0.0.0.0/8
    if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return true; // 172.16/12
    if (p[0] === 192 && p[1] === 168) return true; // 192.168/16
    if (p[0] === 169 && p[1] === 254) return true; // link-local + metadatos nube
    if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return true; // CGNAT 100.64/10
    if (p[0] >= 224) return true; // multicast / reservado
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === "::1" || low === "::") return true; // loopback / unspecified
    if (low.startsWith("fe80")) return true; // link-local
    if (low.startsWith("fc") || low.startsWith("fd")) return true; // ULA privada
    // IPv4 mapeada (::ffff:a.b.c.d)
    const m = low.match(/::ffff:(\d+\.\d+\.\d+\.\d+)/);
    if (m) return isForbiddenIp(m[1]);
    return false;
  }
  return true; // forma desconocida: rechazar
}

// Valida el esquema/puerto/host y resuelve el DNS para comprobar que NINGUNA
// de sus IPs cae en un rango prohibido (mitiga rebinding en el momento de la
// validación).
export async function assertPublicUrl(raw: string): Promise<UrlCheck> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "URL inválida" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, reason: "Solo se permiten http(s)" };
  }

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  const allowedPorts = new Set([80, 443, 8080, 8443]);
  if (!allowedPorts.has(port)) {
    return { ok: false, reason: `Puerto no permitido: ${port}` };
  }

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    return { ok: false, reason: "Host interno no permitido" };
  }

  // Si el host ya es una IP literal, validarla directamente.
  if (net.isIP(host)) {
    if (isForbiddenIp(host)) return { ok: false, reason: "IP interna/reservada no permitida" };
    return { ok: true, url };
  }

  // Resolver DNS y verificar todas las direcciones.
  try {
    const records = await lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: "El dominio no resuelve" };
    for (const r of records) {
      if (isForbiddenIp(r.address)) {
        return { ok: false, reason: "El dominio resuelve a una dirección interna/reservada" };
      }
    }
  } catch {
    return { ok: false, reason: "No se pudo resolver el dominio" };
  }

  return { ok: true, url };
}

// Fetch con límites: timeout, sin seguir redirecciones automáticamente (cada
// salto se re-valida), y tope de tamaño de respuesta.
export async function safeFetch(
  rawUrl: string,
  opts: { method?: string; maxRedirects?: number; timeoutMs?: number } = {}
): Promise<{ res: Response; finalUrl: string; body: string } | { error: string }> {
  const { method = "GET", maxRedirects = 3, timeoutMs = 10000 } = opts;
  let current = rawUrl;

  for (let i = 0; i <= maxRedirects; i++) {
    const check = await assertPublicUrl(current);
    if (!check.ok) return { error: check.reason };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(check.url.toString(), {
        method,
        redirect: "manual",
        signal: controller.signal,
        headers: { "User-Agent": "GuardianToolsIT/1.0 (+security-scan)" },
      });
      clearTimeout(timer);

      if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
        current = new URL(res.headers.get("location")!, check.url).toString();
        continue;
      }

      // Leer como máximo ~512 KB del cuerpo.
      const reader = res.body?.getReader();
      let body = "";
      if (reader) {
        const decoder = new TextDecoder();
        let total = 0;
        const MAX = 512 * 1024;
        while (total < MAX) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          body += decoder.decode(value, { stream: true });
        }
        await reader.cancel().catch(() => {});
      }

      return { res, finalUrl: check.url.toString(), body };
    } catch (err) {
      clearTimeout(timer);
      return { error: err instanceof Error && err.name === "AbortError" ? "Tiempo de espera agotado" : "Fallo de conexión" };
    }
  }

  return { error: "Demasiadas redirecciones" };
}

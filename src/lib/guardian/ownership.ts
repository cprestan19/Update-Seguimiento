import { resolveTxt } from "dns/promises";
import { randomBytes } from "crypto";
import { safeFetch } from "./ssrfGuard";

// Prueba de propiedad de un objetivo URL. El dueño debe publicar el token, bien
// como registro DNS TXT del dominio, bien como archivo en
// /.well-known/guardian-verify.txt. Mientras no lo haga, Guardian solo puede
// hacer comprobaciones no intrusivas de la portada pública.

export function newVerificationToken(): string {
  return `guardian-verify=${randomBytes(16).toString("hex")}`;
}

export async function checkOwnership(targetUrl: string, token: string): Promise<{ verified: boolean; method?: string }> {
  let host: string;
  try {
    host = new URL(targetUrl).hostname;
  } catch {
    return { verified: false };
  }

  // 1) DNS TXT
  try {
    const records = await resolveTxt(host);
    const flat = records.map((r) => r.join("")).join(" ");
    if (flat.includes(token)) return { verified: true, method: "DNS TXT" };
  } catch {
    // sin TXT o fallo de resolución: probar well-known
  }

  // 2) Archivo well-known
  const base = `${new URL(targetUrl).origin}/.well-known/guardian-verify.txt`;
  const result = await safeFetch(base, { method: "GET" });
  if (!("error" in result) && result.res.status === 200 && result.body.includes(token)) {
    return { verified: true, method: "/.well-known" };
  }

  return { verified: false };
}

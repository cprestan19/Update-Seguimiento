import { createHmac, timingSafeEqual } from "crypto";

// Comprobante de desbloqueo de Departamento.
//
// El desbloqueo se guarda en el JWT de NextAuth (deptAdminIds), y la única
// forma de escribir en el JWT desde el cliente es useSession().update(datos)
// — cuyo contenido controla por completo el navegador. Por eso el callback
// jwt NUNCA debe confiar en un departmentId enviado por el cliente: solo
// acepta este comprobante, emitido por /api/departments/[id]/unlock tras
// validar la contraseña, firmado con HMAC (NEXTAUTH_SECRET), ligado al
// usuario y de vida muy corta.

const TTL_MS = 2 * 60 * 1000;

type Payload = { u: string; d: string; exp: number };

function getSecret(): string {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET no está configurado");
  return secret;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(`dept-unlock:${data}`).digest("base64url");
}

export function issueDeptUnlockToken(userId: string, departmentId: string): string {
  const payload: Payload = { u: userId, d: departmentId, exp: Date.now() + TTL_MS };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data)}`;
}

// Devuelve el departmentId si el comprobante es auténtico, no venció y
// pertenece a `userId`; si no, null.
export function verifyDeptUnlockToken(token: unknown, userId: string): string | null {
  if (typeof token !== "string" || token.length > 1024) return null;
  const [data, mac] = token.split(".");
  if (!data || !mac) return null;

  const expected = Buffer.from(sign(data));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as Payload;
    if (payload.u !== userId || typeof payload.d !== "string" || Date.now() > payload.exp) return null;
    return payload.d;
  } catch {
    return null;
  }
}

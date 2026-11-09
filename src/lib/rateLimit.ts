import { Redis } from "@upstash/redis";

// Limitador de intentos de ventana fija sobre Upstash Redis (ya usado por el
// canal de tiempo real). Si Redis no está configurado o falla, se permite la
// operación (fail-open) y se deja traza: el login no debe caerse por Redis,
// pero el problema queda visible en los logs.

let client: Redis | null = null;
function getClient(): Redis | null {
  if (client) return client;
  try {
    client = Redis.fromEnv();
    return client;
  } catch {
    return null;
  }
}

export type RateLimitResult = { allowed: boolean; count: number; limit: number };

// Consulta sin consumir (para bloquear antes de verificar la contraseña).
export async function peekAttempts(key: string, limit: number): Promise<RateLimitResult> {
  const redis = getClient();
  if (!redis) return { allowed: true, count: 0, limit };
  try {
    const count = Number((await redis.get<number>(`rl:${key}`)) ?? 0);
    return { allowed: count < limit, count, limit };
  } catch (err) {
    console.warn("[rateLimit] Redis no disponible, se permite la operación", err);
    return { allowed: true, count: 0, limit };
  }
}

// Registra un intento (normalmente uno fallido).
export async function hitAttempt(key: string, windowSec: number): Promise<number> {
  const redis = getClient();
  if (!redis) return 0;
  try {
    const k = `rl:${key}`;
    const count = await redis.incr(k);
    if (count === 1) await redis.expire(k, windowSec);
    return count;
  } catch (err) {
    console.warn("[rateLimit] Redis no disponible al registrar intento", err);
    return 0;
  }
}

export async function resetAttempts(key: string): Promise<void> {
  const redis = getClient();
  if (!redis) return;
  try {
    await redis.del(`rl:${key}`);
  } catch {
    // sin efecto: el contador vence solo
  }
}

export function clientIpFromHeaders(headers: Headers | Record<string, unknown> | undefined): string {
  if (!headers) return "desconocida";
  const get = (name: string): string | null => {
    if (headers instanceof Headers) return headers.get(name);
    const v = (headers as Record<string, unknown>)[name];
    return typeof v === "string" ? v : Array.isArray(v) ? String(v[0]) : null;
  };
  const fwd = get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return get("x-real-ip") || "desconocida";
}

// Políticas compartidas
export const LOGIN_LIMIT = { perUser: 5, perIp: 30, windowSec: 15 * 60 };
export const UNLOCK_LIMIT = { perUserDept: 5, windowSec: 15 * 60 };

import { Redis } from "@upstash/redis";

const CHANNEL = "app:changes";

let client: Redis | null = null;
function getClient() {
  if (!client) client = Redis.fromEnv();
  return client;
}

export type ChangeScope = "stores" | "users";

// Avisa a todos los clientes conectados (vía WebSocket) que algo cambió,
// para que refresquen esa sección sin esperar a un refresco manual.
export async function publishChange(scope: ChangeScope) {
  try {
    await getClient().publish(CHANNEL, JSON.stringify({ scope, at: Date.now() }));
  } catch {
    // Si Redis falla, no bloqueamos la operación principal — el usuario
    // simplemente no ve el refresco en vivo hasta su próximo polling/reload.
  }
}

export { CHANNEL };

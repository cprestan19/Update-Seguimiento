import { Redis } from "@upstash/redis";

const CHANNEL = "app:changes";

let client: Redis | null = null;
function getClient() {
  if (!client) client = Redis.fromEnv();
  return client;
}

export type ChangeScope = "stores" | "users" | "seguimiento";

// Avisa a los clientes conectados DEL MISMO PROYECTO que algo cambió, para
// que refresquen esa sección sin esperar a un refresco manual. projectId es
// obligatorio para que el endpoint SSE pueda filtrar por proyecto y no
// mezclar cambios entre proyectos distintos.
export async function publishChange(scope: ChangeScope, projectId: string) {
  try {
    await getClient().publish(CHANNEL, JSON.stringify({ scope, projectId, at: Date.now() }));
  } catch {
    // Si Redis falla, no bloqueamos la operación principal — el usuario
    // simplemente no ve el refresco en vivo hasta su próximo polling/reload.
  }
}

export { CHANNEL };

import { getServerSession } from "next-auth";
import Redis from "ioredis";
import { authOptions } from "@/lib/auth";
import { CHANNEL } from "@/lib/realtime";

// Canal de tiempo real vía Server-Sent Events: cada cliente conectado se
// suscribe al mismo canal de Redis (Upstash) y reenvía por SSE cualquier
// aviso de cambio. Necesario porque cada instancia de función en Vercel es
// independiente — sin este pub/sub, un cambio hecho por un usuario nunca
// le llegaría a los demás conectados.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("No autorizado", { status: 401 });

  const encoder = new TextEncoder();
  let sub: Redis | null = null;
  let keepAlive: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      sub = new Redis(process.env.REDIS_URL!);
      sub.subscribe(CHANNEL).catch(() => {});
      sub.on("message", (_channel, message) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
        } catch {
          // el stream ya pudo haberse cerrado
        }
      });

      // Comentario periódico para que proxies intermedios no cierren la
      // conexión por inactividad.
      keepAlive = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          if (keepAlive) clearInterval(keepAlive);
        }
      }, 25_000);
    },
    cancel() {
      sub?.disconnect();
      if (keepAlive) clearInterval(keepAlive);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

import { experimental_upgradeWebSocket } from "@vercel/functions";
import { getServerSession } from "next-auth";
import Redis from "ioredis";
import { authOptions } from "@/lib/auth";
import { CHANNEL } from "@/lib/realtime";

// Canal de tiempo real: cada cliente conectado se suscribe al mismo canal
// de Redis (Upstash) y reenvía por WebSocket cualquier aviso de cambio.
// Necesario porque cada conexión WebSocket en Vercel queda fija a una
// instancia distinta — sin este pub/sub, un cambio hecho por un usuario
// nunca le llegaría a los demás conectados.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("No autorizado", { status: 401 });

  return experimental_upgradeWebSocket((ws) => {
    const sub = new Redis(process.env.REDIS_URL!);
    sub.subscribe(CHANNEL).catch(() => {});

    sub.on("message", (_channel, message) => {
      try {
        ws.send(message);
      } catch {
        // la conexión ya pudo haberse cerrado
      }
    });

    ws.on("close", () => {
      sub.disconnect();
    });
  });
}

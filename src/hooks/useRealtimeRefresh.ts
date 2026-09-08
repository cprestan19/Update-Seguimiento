"use client";

import { useEffect, useRef } from "react";

// Escucha /api/ws y llama onChange() cuando llega un aviso del scope
// indicado (ej. "stores"). Reconecta solo con backoff si la conexion se
// cae (deploys, limite de duracion de la funcion, etc.).
export function useRealtimeRefresh(scope: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let delay = 1000;
    let closedByUs = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function connect() {
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${proto}//${window.location.host}/api/ws`);

      socket.addEventListener("open", () => {
        delay = 1000;
      });

      socket.addEventListener("message", (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.scope === scope) onChangeRef.current();
        } catch {
          // ignorar mensajes que no sean JSON valido
        }
      });

      socket.addEventListener("close", () => {
        if (closedByUs) return;
        retryTimer = setTimeout(connect, delay);
        delay = Math.min(delay * 2, 30_000);
      });
    }

    connect();

    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
  }, [scope]);
}

"use client";

import { useEffect, useRef } from "react";

// Escucha /api/events (Server-Sent Events) y llama onChange() cuando llega
// un aviso del scope indicado (ej. "stores"). EventSource reconecta solo
// si la conexión se cae (deploys, límite de duración de la función, etc.).
export function useRealtimeRefresh(scope: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.scope === scope) onChangeRef.current();
      } catch {
        // ignorar mensajes que no sean JSON válido (ej. comentarios de keep-alive)
      }
    };

    return () => {
      source.close();
    };
  }, [scope]);
}

"use client";

import { useEffect, useRef } from "react";

// Respaldo por si el SSE nunca llega a conectar o se cae en silencio (proxy
// corporativo que bloquea streaming, límite de duración de función, etc.):
// sin esto, esos casos se quedan desactualizados hasta un F5 manual.
const POLL_FALLBACK_MS = 20_000;

// Escucha /api/events (Server-Sent Events) y llama onChange() cuando llega
// un aviso del scope indicado (ej. "stores"). Además, para no depender
// 100% de que la conexión SSE se mantenga viva, revisa por si acaso cada
// POLL_FALLBACK_MS, y se refresca una vez extra cada vez que el SSE
// (re)conecta, por si se perdió algún aviso mientras estuvo caído.
export function useRealtimeRefresh(scope: string, onChange: () => void) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    let yaConectoUnaVez = false;
    const source = new EventSource("/api/events");

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.scope === scope) onChangeRef.current();
      } catch {
        // ignorar mensajes que no sean JSON válido (ej. comentarios de keep-alive)
      }
    };

    source.onopen = () => {
      if (yaConectoUnaVez) onChangeRef.current();
      yaConectoUnaVez = true;
    };

    const poll = setInterval(() => onChangeRef.current(), POLL_FALLBACK_MS);

    return () => {
      source.close();
      clearInterval(poll);
    };
  }, [scope]);
}

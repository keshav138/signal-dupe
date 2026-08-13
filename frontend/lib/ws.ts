import { useEffect, useRef } from "react";
import { useStore } from "./store";
import { wsUrl } from "./api";
import type { WsEvent } from "./types";

/**
 * Maintains a single WebSocket connection for the logged-in user.
 * Reconnects with exponential backoff and feeds events into the store.
 */
export function useWebSocket() {
  const token = useStore((s) => s.token);
  const handleWsEvent = useStore((s) => s.handleWsEvent);
  const reconnectAttempts = useRef(0);

  useEffect(() => {
    if (!token) return;
    let socket: WebSocket | null = null;
    let closed = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl());

      socket.onmessage = (e) => {
        try {
          const event = JSON.parse(e.data) as WsEvent;
          handleWsEvent(event);
        } catch {
          /* ignore malformed frames */
        }
      };

      socket.onopen = () => {
        reconnectAttempts.current = 0;
      };

      socket.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 15000);
        reconnectAttempts.current += 1;
        reconnectTimer = setTimeout(connect, delay);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token, handleWsEvent]);
}

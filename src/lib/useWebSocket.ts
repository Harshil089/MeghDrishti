"use client";

import { useEffect, useRef } from "react";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
  .replace(/^http/, "ws")
  .replace(/\/api\/v1$/, "");

export interface WsEvent {
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

/** Opens a real WebSocket to the backend's Redis-pub/sub relay and calls
 * `onEvent` for every message. Reconnects with backoff on drop. Returns
 * nothing — this is a side-effect hook, callers trigger a refetch from
 * their own data source in `onEvent`. */
export function useWebSocket(path: string, onEvent: (event: WsEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let socket: WebSocket | null = null;
    let closedByUs = false;
    let retryDelay = 1000;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      socket = new WebSocket(`${WS_BASE}${path}`);

      socket.onmessage = (msg) => {
        try {
          onEventRef.current(JSON.parse(msg.data));
        } catch {
          // ignore malformed frame
        }
      };

      socket.onclose = () => {
        if (closedByUs) return;
        retryTimer = setTimeout(connect, retryDelay);
        retryDelay = Math.min(retryDelay * 2, 15000);
      };

      socket.onopen = () => {
        retryDelay = 1000;
      };
    }

    connect();

    return () => {
      closedByUs = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);
}

"use client";

import { useEffect, useRef } from "react";
import { getToken } from "@/lib/auth";

const WS_BASE = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1")
  .replace(/^http/, "ws")
  .replace(/\/api\/v1$/, "");

export interface WsEvent {
  event_type: string;
  timestamp: string;
  payload: Record<string, unknown>;
}

interface Channel {
  socket: WebSocket | null;
  listeners: Set<(event: WsEvent) => void>;
  retryDelay: number;
  retryTimer: ReturnType<typeof setTimeout> | undefined;
  closedByUs: boolean;
}

// One real WebSocket per path, shared across every useWebSocket(path, ...)
// caller — several components (e.g. Topbar's alert bell + a page's own
// alerts fetch) subscribing to the same channel used to each open their own
// socket. Refcounted via listeners.size; last one out closes it.
const channels = new Map<string, Channel>();

function connect(path: string, channel: Channel) {
  const token = getToken();
  const url = token ? `${WS_BASE}${path}?token=${encodeURIComponent(token)}` : `${WS_BASE}${path}`;
  const socket = new WebSocket(url);
  channel.socket = socket;

  socket.onmessage = (msg) => {
    try {
      const event = JSON.parse(msg.data) as WsEvent;
      channel.listeners.forEach((fn) => fn(event));
    } catch {
      // ignore malformed frame
    }
  };

  socket.onclose = () => {
    if (channel.closedByUs) return;
    channel.retryTimer = setTimeout(() => connect(path, channel), channel.retryDelay);
    channel.retryDelay = Math.min(channel.retryDelay * 2, 15000);
  };

  socket.onopen = () => {
    channel.retryDelay = 1000;
  };
}

function getChannel(path: string): Channel {
  let channel = channels.get(path);
  if (!channel) {
    channel = { socket: null, listeners: new Set(), retryDelay: 1000, retryTimer: undefined, closedByUs: false };
    channels.set(path, channel);
    connect(path, channel);
  }
  return channel;
}

/** Subscribes to the shared WebSocket for `path`, calling `onEvent` for
 * every message. Reconnects with backoff on drop. Returns nothing — this is
 * a side-effect hook, callers trigger a refetch from their own data source
 * in `onEvent`. */
export function useWebSocket(path: string, onEvent: (event: WsEvent) => void) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    const channel = getChannel(path);
    const listener = (event: WsEvent) => onEventRef.current(event);
    channel.listeners.add(listener);

    return () => {
      channel.listeners.delete(listener);
      if (channel.listeners.size === 0) {
        channel.closedByUs = true;
        if (channel.retryTimer) clearTimeout(channel.retryTimer);
        channel.socket?.close();
        channels.delete(path);
      }
    };
  }, [path]);
}

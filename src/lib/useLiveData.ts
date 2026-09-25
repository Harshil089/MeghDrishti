"use client";

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "@/lib/useWebSocket";

/** Polls `fetcher` every `intervalMs`; keeps the last good value (starting
 * with `fallback`) if the backend is unreachable, so the UI never breaks.
 * Pass `deps` to restart polling when the fetcher's inputs change (e.g. a
 * selected station id) — otherwise it fetches once on mount and every
 * `intervalMs` after that. */
export function useLiveData<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  intervalMs = 20000,
  deps: unknown[] = []
): T {
  const [data, setData] = useState<T>(fallback);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetcher();
        if (!cancelled) setData(result);
      } catch {
        // backend unreachable — keep showing the last good value
      }
    }

    load();
    const id = setInterval(load, intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return data;
}

/** Like useLiveData, but refetches immediately whenever the given WebSocket
 * channel emits an event (real push), keeping a slow poll as a safety net
 * in case the socket drops silently. This is what "real-time" actually
 * means in this app — most pages use plain useLiveData (polling) since
 * they don't need sub-second updates. */
export function useLiveDataWs<T>(
  fetcher: () => Promise<T>,
  fallback: T,
  wsPath: string,
  fallbackPollMs = 60000
): T {
  const [data, setData] = useState<T>(fallback);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const result = await fetcherRef.current();
        if (!cancelled) setData(result);
      } catch {
        // backend unreachable — keep showing the last good value
      }
    }
    load();
    const id = setInterval(load, fallbackPollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [fallbackPollMs]);

  useWebSocket(wsPath, () => {
    fetcherRef.current().then(setData).catch(() => {});
  });

  return data;
}

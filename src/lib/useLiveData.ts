"use client";

import { useEffect, useState } from "react";

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

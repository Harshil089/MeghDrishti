"use client";

import { useEffect, useState } from "react";
import { fetchCurrentUser, getToken, type CurrentUser } from "@/lib/auth";

export function useAuth(): { user: CurrentUser | null; loading: boolean } {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      if (!getToken()) {
        if (!cancelled) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const u = await fetchCurrentUser();
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    }

    refresh();
    window.addEventListener("auth-change", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener("auth-change", refresh);
    };
  }, []);

  return { user, loading };
}

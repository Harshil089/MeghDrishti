"use client";

const TOKEN_KEY = "meghdrishti_access_token";
const REFRESH_KEY = "meghdrishti_refresh_token";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:18000/api/v1";

export interface CurrentUser {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  is_active: boolean;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function setTokens(access: string, refresh: string) {
  try {
    localStorage.setItem(TOKEN_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
    window.dispatchEvent(new Event("auth-change"));
  } catch {
    // storage unavailable — session just won't persist across reloads
  }
}

export function logout() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    window.dispatchEvent(new Event("auth-change"));
  } catch {
    // ignore
  }
}

export async function login(email: string, password: string): Promise<void> {
  const body = new URLSearchParams({ username: email, password });
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Login failed");
  }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
}

export async function loginWithGoogle(idToken: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_token: idToken }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null);
    throw new Error(detail?.error?.message ?? "Google sign-in failed");
  }
  const data = await res.json();
  setTokens(data.access_token, data.refresh_token);
}

// Access tokens live 30 minutes. One shared refresh at a time, so a burst of
// parallel 401s triggers a single /auth/refresh call.
let refreshing: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  let refresh: string | null = null;
  try {
    refresh = localStorage.getItem(REFRESH_KEY);
  } catch {
    return false;
  }
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

/** fetch with the bearer token; on 401 refreshes the session once and retries. */
export async function authFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const send = () => fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), ...authHeaders() } });
  const res = await send();
  if (res.status !== 401 || !getToken()) return res;
  refreshing ??= refreshTokens().finally(() => {
    refreshing = null;
  });
  if (!(await refreshing)) {
    logout();
    return res;
  }
  return send();
}

export async function fetchCurrentUser(): Promise<CurrentUser | null> {
  const token = getToken();
  if (!token) return null;
  const res = await authFetch(`${API_BASE}/auth/me`);
  if (!res.ok) return null;
  return (await res.json()) as CurrentUser;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

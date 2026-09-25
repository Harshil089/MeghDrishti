"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Logo from "@/components/Logo";
import { login } from "@/lib/auth";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Logo size={36} />
          <div>
            <h1 className="text-base font-semibold">MeghDrishti</h1>
            <p className="text-xs text-muted">Operator sign-in</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs text-muted">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs text-muted">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-border bg-panel-2 px-3 py-2 text-sm outline-none focus:border-cyan-400/50"
          />
        </div>

        {error && (
          <p className="text-xs text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 text-sm py-2.5 hover:bg-cyan-400/20 transition-colors disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" />
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <p className="text-[11px] text-muted text-center">
          Viewing the dashboard doesn&apos;t require sign-in — this is only needed to acknowledge alerts or submit
          operator reviews.
        </p>
      </form>
    </div>
  );
}

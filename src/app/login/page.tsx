"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { login } from "@/lib/auth";
import { LogIn, ArrowLeft } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  function goToDashboard() {
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      goToDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="w-full max-w-sm glass rounded-2xl p-6 space-y-5">
        <Link href="/" className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground w-fit">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>

        <div className="flex items-center gap-3">
          <Logo size={36} />
          <div>
            <h1 className="text-base font-semibold">Sign in to MeghDrishti</h1>
            <p className="text-xs text-muted">Station console access</p>
          </div>
        </div>

        <GoogleSignInButton onSuccess={goToDashboard} />

        {!showPasswordForm ? (
          <button
            onClick={() => setShowPasswordForm(true)}
            className="w-full text-xs text-muted hover:text-foreground text-center"
          >
            Use email and password instead
          </button>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 pt-1 border-t border-border">
            <div className="space-y-1.5 pt-4">
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
              <p className="text-xs text-rose-400 border border-rose-500/30 bg-rose-500/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-cyan-400/15 border border-cyan-400/30 text-cyan-300 text-sm py-2.5 hover:bg-cyan-400/20 transition-colors disabled:opacity-50"
            >
              <LogIn className="h-4 w-4" />
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { login } from "@/lib/auth";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Radio, ShieldCheck, FileSearch } from "lucide-react";

const POINTS = [
  { icon: ShieldCheck, text: "Rule checks, ML and weather context in one decision" },
  { icon: FileSearch, text: "A reason code behind every flagged reading" },
  { icon: Radio, text: "Live alerts as stations report" },
];

const input =
  "h-11 w-full rounded-xl border border-border bg-panel-2/70 pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted/60 focus:border-accent focus:bg-panel-2 focus-visible:ring-2 focus-visible:ring-accent/25";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    <div className="relative flex-1 grid min-h-[100dvh] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside className="land-glow relative hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="land-bloom absolute -left-24 -top-24 h-[420px] w-[420px] opacity-70" />
        <Link href="/" className="relative flex w-fit items-center gap-2.5">
          <Logo size={34} />
          <span className="text-sm font-semibold tracking-wide">MeghDrishti</span>
        </Link>
        <div className="relative max-w-[460px]">
          <h2 className="mb-4 text-4xl font-semibold leading-[1.1] tracking-tight">
            Real storm, or <span className="gradient-text bg-clip-text text-transparent">broken sensor</span>?
          </h2>
          <p className="mb-8 text-sm leading-relaxed text-muted">
            Sign in to see which of your stations to trust, and why.
          </p>
          <ul className="space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-foreground">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-accent/30 bg-accent/10">
                  <Icon className="h-4 w-4 text-accent" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-muted">Smart India Hackathon 2026</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-8 flex w-fit items-center gap-1.5 text-xs text-muted transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>

          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Logo size={32} />
            <span className="text-sm font-semibold tracking-wide">MeghDrishti</span>
          </div>

          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 mb-7 text-sm text-muted">Sign in to the station console.</p>

          <GoogleSignInButton onSuccess={goToDashboard} />

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted">
            <span className="h-px flex-1 bg-border" />
            or with email
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="username"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={input}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  id="password"
                  type={show ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={`${input} pr-10`}
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-muted transition-colors hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-xl border border-crit/30 bg-crit/10 px-3 py-2 text-xs text-crit">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl c-grad-brand text-sm font-medium text-white shadow-lg shadow-accent/25 transition hover:brightness-110 active:scale-[0.99] disabled:opacity-60"
            >
              {busy ? "Signing in…" : "Sign in"}
              {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

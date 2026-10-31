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
  "h-11 w-full rounded-xl border border-line bg-surface pl-10 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-sub/70 focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

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
      <aside className="relative hidden border-r border-line bg-surface lg:flex lg:flex-col lg:justify-between lg:p-14">
        <Link href="/" className="flex w-fit items-center gap-2.5">
          <Logo size={34} />
          <span className="text-sm font-semibold text-ink">MeghDrishti</span>
        </Link>
        <div className="max-w-[480px]">
          <h2 className="text-5xl font-semibold leading-[1.04] tracking-tight text-ink">
            Every reading,
            <br />
            <span className="text-accent">judged.</span>
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-sub">Storm or broken sensor: see the verdict and the evidence behind it for every station in your network.</p>
          <ul className="mt-10 space-y-3">
            {POINTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 rounded-xl border border-line bg-raised/60 px-4 py-3 text-sm text-ink">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-sub">Smart India Hackathon 2026</p>
      </aside>

      {/* Form */}
      <main className="flex items-center justify-center bg-canvas p-4 sm:p-8">
        <div className="w-full max-w-[400px]">
          <Link
            href="/"
            className="mb-8 flex w-fit items-center gap-1.5 text-xs text-sub transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back
          </Link>

          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Logo size={32} />
            <span className="text-sm font-semibold tracking-wide">MeghDrishti</span>
          </div>

          <h1 className="text-[30px] font-semibold tracking-tight text-ink">Sign in</h1>
          <p className="mt-1.5 mb-7 text-sm text-sub">Sign in to the station console.</p>

          <GoogleSignInButton onSuccess={goToDashboard} />

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wide text-sub">
            <span className="h-px flex-1 bg-line" />
            or with email
            <span className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-sub">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
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
              <label htmlFor="password" className="text-xs font-medium text-sub">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
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
                  className="absolute right-2.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-sub transition-colors hover:text-ink"
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
              className="group flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-on-accent transition-colors hover:bg-accent/90 active:scale-[0.99] disabled:opacity-60"
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

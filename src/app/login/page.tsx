"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { login } from "@/lib/auth";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Radio, ShieldCheck, FileSearch, AlertTriangle } from "lucide-react";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

const POINTS = [
  {
    icon: ShieldCheck,
    title: "Multi-Tier Quality Control",
    text: "11 deterministic WMO rules + Isolation Forest ML + spatial and satellite consensus.",
  },
  {
    icon: FileSearch,
    title: "Reason-Coded Verdicts",
    text: "Evidence dossiers with NASA GPM, ECMWF ERA5, and neighboring station validation.",
  },
  {
    icon: Radio,
    title: "3,100+ AWS National Grid",
    text: "15-minute synoptic telemetry stream with prioritized maintenance dispatch queue.",
  },
];

const input =
  "h-10 w-full rounded-lg border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-all placeholder:text-sub/70 focus:border-accent focus:shadow-xs focus-visible:ring-2 focus-visible:ring-accent/20";

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
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative flex-1 grid min-h-[100dvh] lg:grid-cols-[1.1fr_1fr]">
      {/* Left Product Briefing Panel */}
      <aside className="relative hidden flex-col justify-between border-r border-[#1a2234] bg-[#090d16] text-slate-200 lg:flex">
        <div className="px-10 pt-10">
          <Link href="/" className="flex w-fit items-center gap-3 group">
            <Logo size={32} />
            <span className="text-base font-semibold tracking-tight text-white group-hover:text-blue-300 transition-colors">
              MeghDrishti
            </span>
          </Link>
        </div>

        <div className="max-w-[500px] px-10 py-8">
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white">
            National weather observation & quality control.
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            Verify flagged station readings, inspect multi-source spatial consensus, and record binding classifications.
          </p>

          <ul className="mt-8 space-y-3">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li
                key={title}
                className="flex items-start gap-3.5 rounded-xl border border-[#1a2234] bg-[#0e1424]/60 px-4 py-3.5 text-xs transition-colors hover:border-[#2a3654]"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-blue-500/30 bg-blue-500/10 text-blue-400">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <span className="font-semibold text-white">{title}</span>
                  <p className="mt-0.5 text-slate-400 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[#1a2234] px-10 py-4 text-xs text-slate-500 flex items-center justify-between">
          <span>Operational Platform</span>
          <span>v2.6</span>
        </div>
      </aside>

      {/* Right Authentication Form */}
      <main className="flex flex-col justify-between bg-canvas">
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-[400px]">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-1.5 text-xs text-sub transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Link>

            <SpotlightCard
              spotlightColor="rgba(37, 99, 235, 0.08)"
              spotlightSize={320}
              className="overflow-hidden rounded-2xl border border-line bg-surface p-6 sm:p-8 shadow-sm"
            >
              <div className="mb-5 flex items-center gap-2.5 lg:hidden">
                <Logo size={28} />
                <span className="text-sm font-semibold tracking-tight text-ink">MeghDrishti</span>
              </div>

              <h1 className="text-xl font-bold tracking-tight text-ink">Sign in</h1>
              <p className="mt-1 mb-6 text-xs text-sub">
                Authenticate with your operator credentials to access live telemetry.
              </p>

              <GoogleSignInButton onSuccess={goToDashboard} />

              <div className="my-5 flex items-center gap-3 text-[11px] text-sub">
                <span className="h-px flex-1 bg-line" />
                or email
                <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-xs font-medium text-sub">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="username"
                      placeholder="operator@meghdrishti.local"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={input}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-xs font-medium text-sub">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" />
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
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-sub transition-colors hover:text-ink cursor-pointer"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="flex items-center gap-2 rounded-lg border border-crit/30 bg-crit/10 px-3 py-2 text-xs text-crit">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={busy}
                  className="group flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-accent text-xs font-semibold text-on-accent transition-all hover:bg-accent/90 shadow-xs cursor-pointer disabled:opacity-60"
                >
                  {busy ? "Verifying…" : "Sign in"}
                  {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </motion.button>
              </form>
            </SpotlightCard>
          </div>
        </div>
      </main>
    </div>
  );
}

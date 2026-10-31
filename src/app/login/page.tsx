"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/Logo";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { login } from "@/lib/auth";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, Radio, ShieldCheck, FileSearch, AlertTriangle } from "lucide-react";

const POINTS = [
  {
    code: "WMO-QC-01",
    icon: ShieldCheck,
    title: "Multi-Tier Quality Control",
    text: "11 deterministic WMO rules + Isolation Forest ML + spatial/satellite consensus",
  },
  {
    code: "AUDIT-02",
    icon: FileSearch,
    title: "Explicit Reason-Coded Verdicts",
    text: "Full evidence dossiers with NASA GPM, ECMWF ERA5, and neighboring station checks",
  },
  {
    code: "STREAM-03",
    icon: Radio,
    title: "National 3,100+ AWS Grid",
    text: "Real-time 15-minute synoptic telemetry stream and prioritized field maintenance queue",
  },
];

const input =
  "h-10 w-full rounded border border-line bg-surface pl-9 pr-3 text-sm text-ink outline-none transition-colors placeholder:text-sub/70 focus:border-accent focus-visible:ring-2 focus-visible:ring-accent/20";

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
    <div className="relative flex-1 grid min-h-[100dvh] lg:grid-cols-[1.08fr_1fr]">
      {/* Left Institutional Command Briefing Panel */}
      <aside className="relative hidden flex-col justify-between border-r border-[#1e3358] bg-[#0b172a] text-slate-200 lg:flex">
        <div>
          <div className="gov-tricolor" />
          <div className="border-b border-[#1e3358] px-10 py-4 font-mono text-[10px] uppercase tracking-wider text-slate-400">
            GOVERNMENT OF INDIA · MINISTRY OF EARTH SCIENCES · IMD AWS TELEMETRY COMMAND
          </div>
          <div className="px-10 pt-8">
            <Link href="/" className="flex w-fit items-center gap-3">
              <Logo size={36} />
              <div>
                <span className="block text-base font-bold tracking-tight text-white">MeghDrishti</span>
                <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  National AWS Quality Intelligence · v2.6
                </span>
              </div>
            </Link>
          </div>
        </div>

        <div className="max-w-[540px] px-10 py-8">
          <span className="inline-flex items-center gap-2 rounded border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-blue-300">
            RESTRICTED ACCESS · AUTHORIZED METEOROLOGICAL PERSONNEL
          </span>
          <h2 className="mt-4 text-4xl font-bold leading-[1.1] tracking-tight text-white">
            National Surface Observation & Quality Control Workbench.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            Verify flagged AWS/ARG station readings, inspect multi-source spatial consensus, and record binding operator
            classifications into the national telemetry ledger.
          </p>

          <ul className="mt-8 space-y-3">
            {POINTS.map(({ code, icon: Icon, title, text }) => (
              <li
                key={code}
                className="flex items-start gap-3.5 rounded border border-[#1e3358] bg-[#13233f]/80 px-4 py-3 text-xs"
              >
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded border border-blue-400/30 bg-blue-500/15 text-blue-300">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{title}</span>
                    <span className="font-mono text-[10px] text-blue-300">{code}</span>
                  </div>
                  <p className="mt-0.5 text-slate-300 leading-relaxed">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="border-t border-[#1e3358] bg-[#081120] px-10 py-4 font-mono text-[10px] uppercase tracking-wider text-slate-400 flex items-center justify-between">
          <span>WMO-NO. 8 COMPLIANT QC PIPELINE</span>
          <span>SMART INDIA HACKATHON 2026</span>
        </div>
      </aside>

      {/* Right Authentication Form */}
      <main className="flex flex-col justify-between bg-canvas">
        <div className="lg:hidden">
          <div className="gov-tricolor" />
        </div>
        <div className="flex flex-1 items-center justify-center p-4 sm:p-8">
          <div className="w-full max-w-[420px]">
            <Link
              href="/"
              className="mb-6 inline-flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-sub transition-colors hover:text-ink"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Return to Executive Overview
            </Link>

            <div className="c-card overflow-hidden rounded-md border-t-4 border-t-accent bg-surface p-6 sm:p-8 shadow-sm">
              <div className="mb-5 flex items-center gap-3 lg:hidden">
                <Logo size={32} />
                <div>
                  <span className="block text-sm font-bold tracking-tight text-ink">MeghDrishti</span>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-sub">
                    IMD AWS Telemetry Command
                  </span>
                </div>
              </div>

              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.12em] text-accent">
                OPERATOR AUTHENTICATION // CLEARANCE GATEWAY
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Sign in to Command Console</h1>
              <p className="mt-1 mb-6 text-xs leading-relaxed text-sub">
                Authenticate with your institutional SSO or operator credentials to access live station telemetry.
              </p>

              <GoogleSignInButton onSuccess={goToDashboard} />

              <div className="my-5 flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-sub">
                <span className="h-px flex-1 bg-line" />
                OR OPERATOR CREDENTIALS
                <span className="h-px flex-1 bg-line" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-sub">
                    Official Email / Operator ID
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
                  <label htmlFor="password" className="block font-mono text-[11px] font-semibold uppercase tracking-wider text-sub">
                    Passphrase
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
                      className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-sub transition-colors hover:text-ink"
                    >
                      {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {error && (
                  <p role="alert" className="flex items-center gap-2 rounded border border-crit/30 bg-crit/10 px-3 py-2 text-xs text-crit">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="group flex h-10 w-full items-center justify-center gap-2 rounded bg-accent text-xs font-semibold uppercase tracking-wider text-on-accent transition-colors hover:bg-accent/90 active:translate-y-px disabled:opacity-60"
                >
                  {busy ? "Verifying Credentials…" : "Authenticate & Enter Console"}
                  {!busy && <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />}
                </button>
              </form>

              <div className="mt-5 rounded border border-line bg-raised/60 px-3 py-2.5 font-mono text-[10px] leading-relaxed text-sub">
                AUDIT NOTICE: All operator classifications, alert acknowledgements, and model activations are logged with
                operator identity and UTC timestamp.
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

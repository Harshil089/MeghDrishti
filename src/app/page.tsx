"use client";

import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  Check,
  CloudRain,
  GitFork,
  Thermometer,
  X,
  ShieldCheck,
  Satellite,
  Database,
  FileCheck2,
  Cpu,
  Radio,
} from "lucide-react";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import AsciiBackdrop from "@/components/ascii/AsciiBackdrop";
import AsciiArt from "@/components/ascii/AsciiArt";
import { radar, stationsSm, trace } from "@/components/ascii/art";
import { pipelineStages } from "@/lib/mock-data";

const REPO = "https://github.com/Harshil089/MeghDrishti";

const ARCHITECTURE_STATS = [
  {
    code: "SCALE-01",
    value: "3,111+",
    label: "National AWS & ARG Stations",
    sub: "Pan-India coverage across 36 States & UTs",
  },
  {
    code: "WMO-QC-02",
    value: "11",
    label: "Deterministic Rule Checks",
    sub: "Range, spike, persistence, drift & step limits",
  },
  {
    code: "FUSION-03",
    value: "4",
    label: "Spatial & Satellite Context Feeds",
    sub: "Neighboring AWS, NASA GPM, ERA5 & NWP",
  },
  {
    code: "AUDIT-04",
    value: "6",
    label: "Auditable Ensemble Verdicts",
    sub: "Reason-coded decisions with operator review",
  },
];

const EXAMPLES = [
  {
    code: "CASE STUDY A · CONVECTIVE EXTREME",
    where: "Pune AWS (IMD_PUNE_001) · Tipping-Bucket Rain Gauge",
    value: "182.0",
    unit: "mm / 15 min",
    Icon: CloudRain,
    verdict: "LIKELY_GENUINE_EXTREME",
    verdictLabel: "Verified Severe Weather Event",
    real: true,
    checks: [
      "Neighboring AWS stations within 25 km confirm intense convective core",
      "NASA GPM IMERG satellite precipitation rate matches storm footprint",
      "High-resolution NWP forecast projected localized heavy rainfall",
    ],
    disposition: "Cleared for IMD Nowcast & State Disaster Management (SDMA) alert feeds.",
  },
  {
    code: "CASE STUDY B · HARDWARE PROBE FAULT",
    where: "Nagpur AWS (IMD_NAGPUR_001) · Surface Air Temperature",
    value: "49.2",
    unit: "°C in 5 min",
    Icon: Thermometer,
    verdict: "PROBABLE_SENSOR_FAULT",
    verdictLabel: "Quarantined Sensor Spike / Fault",
    real: false,
    checks: [
      "Surrounding regional stations report stable 31.8 °C – 32.4 °C median",
      "ECMWF ERA5 reanalysis shows no corresponding thermal advection",
      "+17.0 °C jump in one 5-min packet violates probe thermal inertia limits",
    ],
    disposition: "Withheld from NWP assimilation; automated field recalibration work order generated.",
  },
];

const GOVERNANCE_PILLARS = [
  {
    icon: ShieldCheck,
    code: "WMO-NO.8 ALIGNED",
    title: "Standardized Meteorological QC",
    detail:
      "Implements physical range, temporal rate-of-change, flatline persistence, and step-change checks aligned with WMO and IMD surface observation guidelines.",
  },
  {
    icon: Database,
    code: "IMMUTABLE TELEMETRY",
    title: "Zero Silent Data Interpolation",
    detail:
      "Raw AWS and ARG packets are archived exactly as transmitted. Quality scores, ML anomaly probabilities, and reason codes attach as non-destructive metadata.",
  },
  {
    icon: Satellite,
    code: "SPATIAL CONSENSUS",
    title: "Satellite & Reanalysis Fusion",
    detail:
      "Every flagged reading is automatically cross-verified against neighboring surface stations, NASA GPM satellite rainfall, ECMWF ERA5, and NWP forecast bands.",
  },
  {
    icon: FileCheck2,
    code: "HUMAN-IN-THE-LOOP",
    title: "Cryptographic Operator Audit Trail",
    detail:
      "Duty meteorologists review evidence dossiers and log binding dispositions (Sensor Fault, Valid Extreme, False Positive) with full auditability.",
  },
];

const LON = ["68°E", "72°E", "76°E", "80°E", "84°E", "88°E", "92°E", "96°E"];
const LAT = ["32°N", "28°N", "24°N", "20°N", "16°N", "12°N", "08°N"];

function ChartFrame() {
  const tick = "font-mono text-[10px] tracking-wider text-sub/80";
  const pill = "rounded bg-canvas/90 px-1";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      <div className="absolute inset-x-10 top-[24px] flex justify-between">
        {LON.map((l) => (
          <span key={l} className={`${tick} flex flex-col items-center gap-1`}>
            <span className="h-2 w-px bg-line" />
            <span className={pill}>{l}</span>
          </span>
        ))}
      </div>
      <div className="absolute bottom-24 left-3 top-[72px] flex flex-col justify-between">
        {LAT.map((l) => (
          <span key={l} className={`${tick} flex items-center gap-1.5`}>
            <span className="h-px w-2 bg-line" />
            <span className={pill}>{l}</span>
          </span>
        ))}
      </div>
      <div className="absolute bottom-24 right-3 top-[72px] flex flex-col justify-between">
        {LAT.map((l) => (
          <span key={l} className={`${tick} flex items-center gap-1.5`}>
            <span className={pill}>{l}</span>
            <span className="h-px w-2 bg-line" />
          </span>
        ))}
      </div>
    </div>
  );
}

function SectionBadge({ code, label }: { code: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded border border-line bg-surface px-3 py-1 font-mono text-[11px] uppercase tracking-wider shadow-2xs">
      <span className="font-semibold text-accent">{code}</span>
      <span className="text-line">|</span>
      <span className="text-sub">{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const wrap = "mx-auto max-w-[1280px] px-4 md:px-8";

  return (
    <div className="relative isolate flex-1 bg-canvas text-ink">
      <AsciiBackdrop field={0.65}>
        <AsciiArt art={stationsSm} x={0.88} dy={0.48} depth={0.45} effect="twinkle" />
        <AsciiArt art={trace} anchor="#signal" center x={0.5} depth={0.85} effect="reveal" />
        <AsciiArt art={radar} anchor="#radar" center x={0.28} depth={0.88} effect="sweep" />
      </AsciiBackdrop>

      {/* Top Official Government of India / MoES Institutional Masthead */}
      <div className="sticky top-0 z-50">
        <div className="gov-tricolor" />
        <div className="border-b border-[#1e3358] bg-[#0b172a] text-slate-300">
          <div className={`${wrap} flex flex-wrap items-center justify-between gap-2 py-1.5 font-mono text-[10px] uppercase tracking-wider`}>
            <div className="flex items-center gap-2.5">
              <span className="font-semibold text-white">भारत सरकार · पृथ्वी विज्ञान मंत्रालय</span>
              <span className="hidden text-slate-500 sm:inline">|</span>
              <span className="hidden sm:inline">Government of India · Ministry of Earth Sciences (MoES) · IMD Initiative</span>
            </div>
            <div className="flex items-center gap-3 text-slate-400">
              <span className="inline-flex items-center gap-1.5 text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                WMO-No. 8 QC Standard
              </span>
              <span className="hidden md:inline">· Smart India Hackathon 2026</span>
            </div>
          </div>
        </div>

        {/* Main Navigation Bar */}
        <header className="border-b border-line bg-surface/95 backdrop-blur-xs">
          <nav className={`${wrap} flex h-16 items-center justify-between gap-6`}>
            <Link href="/" className="flex items-center gap-3">
              <Logo size={36} />
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-ink">MeghDrishti</span>
                  <span className="rounded border border-accent/30 bg-accent-soft px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-accent">
                    v2.6 National Grid
                  </span>
                </div>
                <p className="font-mono text-[10px] uppercase tracking-wider text-sub">
                  National AWS Quality Control & Telemetry Intelligence
                </p>
              </div>
            </Link>

            <div className="hidden items-center gap-6 text-xs font-medium uppercase tracking-wider text-sub lg:flex">
              <a href="#problem" className="transition-colors hover:text-ink">
                Operational Challenge
              </a>
              <a href="#how" className="transition-colors hover:text-ink">
                6-Stage QC Pipeline
              </a>
              <a href="#radar" className="transition-colors hover:text-ink">
                Spatial Fusion
              </a>
              <a href="#governance" className="transition-colors hover:text-ink">
                Institutional Readiness
              </a>
              <a href={REPO} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink">
                Source Repository
              </a>
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-2 rounded bg-accent px-4 text-xs font-semibold uppercase tracking-wider text-on-accent shadow-xs transition-colors hover:bg-accent/90"
              >
                Launch Command Console <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </nav>
        </header>
      </div>

      {/* Executive Hero Section */}
      <section className="relative overflow-hidden border-b border-line pt-12 pb-20 md:pt-16">
        <div className="absolute inset-x-0 top-0 h-[820px]">
          <ChartFrame />
        </div>

        <div className={`${wrap} relative`}>
          <Reveal>
            <div className="mx-auto max-w-[920px] text-center">
              <SectionBadge
                code="MISSION-CRITICAL METEOROLOGICAL INFRASTRUCTURE"
                label="AUTOMATED AWS / ARG QUALITY CONTROL"
              />
              <h1 className="mt-6 text-4xl font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl md:text-[62px]">
                Automated Quality Assurance for India&apos;s{" "}
                <span className="text-accent">3,100+ Weather Station</span> Network.
              </h1>
              <p className="mx-auto mt-5 max-w-[74ch] text-base leading-relaxed text-sub md:text-[17px]">
                Automatic Weather Stations (AWS) operate in extreme environments where clogged rain gauges, drifting
                thermistors, and telemetry dropouts mimic severe weather. <strong>MeghDrishti</strong> cross-verifies every
                15-minute observation against deterministic WMO rules, unsupervised ML, neighboring stations, and NASA/ECMWF
                satellite feeds—separating genuine cloudbursts and heatwaves from hardware faults in real time.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center gap-2 rounded bg-accent px-6 text-xs font-semibold uppercase tracking-wider text-on-accent shadow-sm transition-colors hover:bg-accent/90"
                >
                  Open Operations Console <ArrowRight className="h-4 w-4" />
                </Link>
                <a
                  href="#how"
                  className="inline-flex h-11 items-center gap-2 rounded border border-line bg-surface px-6 text-xs font-semibold uppercase tracking-wider text-ink transition-colors hover:bg-raised"
                >
                  Inspect 6-Stage QC Pipeline
                </a>
                <a
                  href="#problem"
                  className="inline-flex h-11 items-center gap-2 rounded border border-line bg-surface px-5 text-xs font-medium uppercase tracking-wider text-sub transition-colors hover:text-ink"
                >
                  View Verification Case Studies
                </a>
              </div>
            </div>
          </Reveal>

          {/* Executive KPI Grid */}
          <Reveal delay={0.06}>
            <div className="mt-12 grid grid-cols-1 gap-px overflow-hidden rounded-md border border-line bg-line shadow-sm sm:grid-cols-2 lg:grid-cols-4">
              {ARCHITECTURE_STATS.map((s) => (
                <div key={s.code} className="border-t-2 border-t-accent bg-surface px-6 py-5">
                  <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-accent">{s.code}</p>
                  <p className="mt-1.5 font-mono text-4xl font-bold tabular-nums tracking-tight text-ink">{s.value}</p>
                  <p className="mt-1 text-sm font-semibold text-ink">{s.label}</p>
                  <p className="mt-0.5 text-xs text-sub">{s.sub}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Framed Live Console Preview */}
          <Reveal delay={0.12}>
            <div className="mt-10 overflow-hidden rounded-md border border-line bg-surface shadow-[0_20px_50px_-24px_rgb(11_21_40/0.22)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1e3358] bg-[#0b172a] px-4 py-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2.5">
                  <span className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-rose-500/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
                  </span>
                  <span className="ml-2 font-mono text-[11px] font-semibold uppercase tracking-wider text-white">
                    MEGHDRISHTI-OPS // NATIONAL TELEMETRY COMMAND WORKBENCH
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-wider text-slate-400">
                  <span className="text-emerald-400">● STREAM ACTIVE</span>
                  <span>15-MIN SYNOPTIC CADENCE</span>
                </div>
              </div>
              <div className="bg-canvas p-2 md:p-3">
                <Image
                  src="/console-preview.png"
                  alt="MeghDrishti National AWS Quality Control Console Overview"
                  width={1440}
                  height={900}
                  priority
                  className="h-auto w-full rounded border border-line"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Section 1: The Operational Challenge (Case Study Comparison) */}
      <section id="problem" className={`${wrap} scroll-mt-24 pt-20 pb-16`}>
        <Reveal>
          <div className="max-w-[780px]">
            <SectionBadge code="OPERATIONAL CHALLENGE" label="EXTREME WEATHER VS. INSTRUMENT FAILURE" />
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">
              Two Critical Telemetry Spikes. Two Opposite Operational Decisions.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-sub">
              Simple threshold filters fail meteorological operations: setting thresholds too tight discards genuine
              cloudbursts, while setting them too loose lets broken sensors trigger false heatwave or flood advisories.
              MeghDrishti resolves this ambiguity by fusing local rules with spatial and satellite evidence.
            </p>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {EXAMPLES.map((e, i) => (
            <Reveal key={e.where} delay={i * 0.08}>
              <article
                className={`c-card flex h-full flex-col justify-between overflow-hidden rounded-md border-t-4 ${
                  e.real ? "border-t-ok" : "border-t-crit"
                }`}
              >
                <div className="p-6 md:p-7">
                  <div className="flex items-start justify-between gap-4 border-b border-line pb-5">
                    <div>
                      <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">{e.code}</p>
                      <p className="mt-1 text-sm font-semibold text-ink">{e.where}</p>
                      <p className="mt-3 flex items-baseline gap-2">
                        <span className="font-mono text-5xl font-bold tabular-nums tracking-tight text-ink">
                          {e.value}
                        </span>
                        <span className="font-mono text-sm font-medium text-sub">{e.unit}</span>
                      </p>
                    </div>
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded border border-line bg-raised text-accent">
                      <e.Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden />
                    </div>
                  </div>

                  <p className="mt-5 font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                    Multi-Source Cross-Verification Evidence
                  </p>
                  <ul className="mt-2.5 space-y-2">
                    {e.checks.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2.5 rounded border border-line/80 bg-canvas/70 px-3.5 py-2.5 text-xs leading-relaxed text-ink"
                      >
                        <span
                          className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-xs ${
                            e.real ? "bg-ok text-white" : "bg-crit text-white"
                          }`}
                        >
                          {e.real ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-line bg-raised/60 px-6 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                      ENSEMBLE VERDICT
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 font-mono text-xs font-semibold uppercase ${
                        e.real ? "border-ok/30 bg-ok/10 text-ok" : "border-crit/30 bg-crit/10 text-crit"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${e.real ? "bg-ok" : "bg-crit"}`} />
                      {e.verdict} · {e.verdictLabel}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-sub">{e.disposition}</p>
                </div>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Live Synoptic Band */}
      <section
        id="signal"
        aria-label="Live temperature trace"
        className={`${wrap} relative my-8 h-[260px] rounded-md border border-line bg-surface/60`}
      >
        <div className="flex items-center justify-between border-b border-line bg-raised/60 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-sub">
          <span>SYNOPTIC WAVEFORM MONITOR // DELHI SAFDARJUNG AWS (42182)</span>
          <span>DIURNAL THERMAL BAND · 48H TRACE</span>
        </div>
        <p className="absolute bottom-3 left-4 font-mono text-[11px] uppercase tracking-wider text-sub">
          Continuous 15-minute observation envelope · Normal diurnal oscillation verified
        </p>
      </section>

      {/* Section 2: 6-Stage Deterministic + AI/ML Quality Pipeline */}
      <section id="how" className="border-y border-line bg-surface py-20 scroll-mt-20">
        <div className={wrap}>
          <Reveal>
            <div className="max-w-[780px]">
              <SectionBadge code="SYSTEM ARCHITECTURE" label="6-STAGE ENSEMBLE QUALITY PIPELINE" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">
                Deterministic WMO Rules + Unsupervised ML + Spatial Consensus.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-sub">
                Every incoming station packet passes through a six-stage verification DAG. No single model acts as a black
                box—each stage contributes structured evidence weights and explicit reason codes.
              </p>
            </div>
          </Reveal>

          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {pipelineStages.map((s, i) => (
              <Reveal key={s.key} delay={i * 0.05}>
                <li className="c-card flex h-full flex-col justify-between rounded-md border-t-2 border-t-accent p-4">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-accent">
                        STAGE {String(i + 1).padStart(2, "0")}
                      </span>
                      <Cpu className="h-4 w-4 text-sub" />
                    </div>
                    <h3 className="mt-3 text-sm font-bold text-ink">{s.label}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-sub">{s.detail}</p>
                  </div>
                  <div className="mt-4 border-t border-line pt-2.5 font-mono text-[10px] uppercase tracking-wider text-sub">
                    {i === pipelineStages.length - 1 ? "OUTPUT: REASON-CODED VERDICT" : `NEXT → STAGE 0${i + 2}`}
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Section 3: Spatial & Satellite Consensus */}
      <section id="radar" className={`${wrap} relative mt-16 grid min-h-[460px] items-center gap-8 py-12 md:grid-cols-2`}>
        <div aria-hidden className="min-h-[280px]" />
        <Reveal>
          <div className="c-card rounded-md border-t-4 border-t-accent p-7 md:p-8">
            <SectionBadge code="SPATIAL-TEMPORAL VERIFICATION" label="OUTSIDE-IN EVIDENCE FUSION" />
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Radar, Satellites, Reanalysis, and Neighboring Stations Checked on Every Flag.
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-sub">
              A single sensor cannot validate itself during severe weather. Before MeghDrishti classifies an anomaly as a
              hardware fault, it queries four independent spatial and atmospheric context layers:
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded border border-line bg-canvas/70 p-3">
                <p className="font-mono text-[11px] font-semibold text-ink">01 · NEIGHBORING AWS GRID</p>
                <p className="mt-1 text-xs text-sub">Spatial median & consistency check across nearby IMD stations.</p>
              </div>
              <div className="rounded border border-line bg-canvas/70 p-3">
                <p className="font-mono text-[11px] font-semibold text-ink">02 · NASA GPM IMERG</p>
                <p className="mt-1 text-xs text-sub">Satellite precipitation rate verification for extreme rain flags.</p>
              </div>
              <div className="rounded border border-line bg-canvas/70 p-3">
                <p className="font-mono text-[11px] font-semibold text-ink">03 · ECMWF ERA5 REANALYSIS</p>
                <p className="mt-1 text-xs text-sub">Synoptic background comparison for temperature, wind & pressure.</p>
              </div>
              <div className="rounded border border-line bg-canvas/70 p-3">
                <p className="font-mono text-[11px] font-semibold text-ink">04 · NWP FORECAST ENSEMBLE</p>
                <p className="mt-1 text-xs text-sub">Expected mesoscale boundary check via Open-Meteo NWP feeds.</p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Section 4: Institutional & Government Readiness */}
      <section id="governance" className="border-t border-line bg-surface py-20 scroll-mt-20">
        <div className={wrap}>
          <Reveal>
            <div className="max-w-[780px]">
              <SectionBadge code="INSTITUTIONAL DEPLOYMENT" label="BUILT FOR NATIONAL METEOROLOGICAL AGENCIES" />
              <h2 className="mt-4 text-3xl font-bold tracking-tight text-ink md:text-4xl">
                Engineered for Mission-Critical Government Operations.
              </h2>
              <p className="mt-3 text-base leading-relaxed text-sub">
                Designed from the ground up to integrate into existing India Meteorological Department (IMD) and State
                Disaster Management data pipelines without disrupting legacy archival formats.
              </p>
            </div>
          </Reveal>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {GOVERNANCE_PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.code} delay={i * 0.06}>
                  <div className="c-card flex h-full flex-col justify-between rounded-md p-6">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="grid h-9 w-9 place-items-center rounded border border-accent/25 bg-accent-soft text-accent">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-sub">
                          {p.code}
                        </span>
                      </div>
                      <h3 className="mt-4 text-base font-bold text-ink">{p.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-sub">{p.detail}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* Executive Call-To-Action */}
      <section id="cta" className={`${wrap} py-16`}>
        <Reveal>
          <div className="overflow-hidden rounded-md border border-[#1e3358] bg-[#0b172a] text-white shadow-lg">
            <div className="gov-tricolor" />
            <div className="grid items-center gap-8 px-6 py-12 md:grid-cols-[1fr_auto] md:px-12">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                  LIVE COMMAND & CONTROL DEMONSTRATION · SIH 2026
                </p>
                <h2 className="mt-2 text-3xl font-bold tracking-tight md:text-4xl">
                  Inspect Live National AWS Telemetry & Quality Verdicts.
                </h2>
                <p className="mt-2.5 max-w-[68ch] text-sm leading-relaxed text-slate-300">
                  Access the full operator workbench: monitor 3,100+ stations on the national spatial grid, inspect
                  real-time anomaly dossiers, review sensor reliability indices, and dispatch field maintenance teams.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/login"
                  className="inline-flex h-11 items-center gap-2 rounded bg-[#1d4ed8] px-6 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-blue-600"
                >
                  <Radio className="h-4 w-4" />
                  Launch Command Console
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Official Institutional Footer */}
      <footer className="border-t border-line bg-surface">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4 py-6 text-xs text-sub`}>
          <div className="flex items-center gap-3">
            <Logo size={24} />
            <div>
              <p className="font-semibold text-ink">
                MeghDrishti — National Automatic Weather Station Quality Control Platform
              </p>
              <p className="font-mono text-[10px] uppercase tracking-wider text-sub">
                Smart India Hackathon 2026 · Built for India Meteorological Department (IMD) & MoES Networks
              </p>
            </div>
          </div>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 rounded border border-line bg-canvas px-3 py-1.5 font-mono text-[11px] text-ink transition-colors hover:bg-raised"
          >
            <GitFork className="h-3.5 w-3.5 text-accent" /> github.com/Harshil089/MeghDrishti
          </a>
        </div>
      </footer>
    </div>
  );
}

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
import { SpotlightCard } from "@/components/ui/SpotlightCard";
import { MagneticButton } from "@/components/ui/MagneticButton";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";

const REPO = "https://github.com/Harshil089/MeghDrishti";

const STATS = [
  { numericValue: 3111, suffix: "+", label: "National Weather Stations" },
  { numericValue: 11, label: "Deterministic QC Checks" },
  { numericValue: 4, label: "Satellite & Spatial Feeds" },
  { numericValue: 15, suffix: "m", label: "Synoptic Telemetry Cadence" },
];

const EXAMPLES = [
  {
    title: "Pune AWS · Tipping-Bucket Rain Gauge",
    value: 182.0,
    unit: "mm / 15m",
    Icon: CloudRain,
    verdict: "Verified Extreme Weather",
    real: true,
    spotlight: "rgba(21, 128, 61, 0.12)",
    checks: [
      "Neighboring stations confirm localized convective core",
      "NASA GPM satellite precipitation matches footprint",
      "NWP mesoscale forecast projected heavy precipitation band",
    ],
    summary: "Cleared for national weather warnings and disaster management feeds.",
  },
  {
    title: "Nagpur AWS · Air Temperature Probe",
    value: 49.2,
    unit: "°C in 5m",
    Icon: Thermometer,
    verdict: "Sensor Fault Quarantined",
    real: false,
    spotlight: "rgba(185, 28, 28, 0.12)",
    checks: [
      "Surrounding stations report stable 32 °C regional median",
      "ECMWF ERA5 shows no thermal advection boundary",
      "+17 °C single-packet spike violates probe thermal inertia",
    ],
    summary: "Withheld from NWP models; automated maintenance dispatch queued.",
  },
];

const FEEDS = [
  {
    icon: Radio,
    title: "Neighboring AWS Grid",
    detail: "Spatial median and variance consensus across surrounding stations within 50 km.",
  },
  {
    icon: Satellite,
    title: "NASA GPM IMERG",
    detail: "Satellite precipitation radar confirmation for suspected convective rainfall extremes.",
  },
  {
    icon: Database,
    title: "ECMWF ERA5 Reanalysis",
    detail: "Synoptic background comparison for temperature, wind vector, and barometric pressure.",
  },
  {
    icon: Cpu,
    title: "NWP Forecast Models",
    detail: "High-resolution mesoscale weather model boundary checks via Open-Meteo feeds.",
  },
];

const PILLARS = [
  {
    icon: ShieldCheck,
    title: "Standardized QC Rules",
    detail: "Range, temporal rate-of-change, flatline persistence, and step-change limit checks.",
  },
  {
    icon: Database,
    title: "Immutable Telemetry",
    detail: "Raw sensor packets preserved verbatim with non-destructive quality metadata.",
  },
  {
    icon: Satellite,
    title: "Spatial Consensus",
    detail: "Cross-verification against nearby surface stations and spaceborne sensors.",
  },
  {
    icon: FileCheck2,
    title: "Operator Audit Trail",
    detail: "Duty meteorologist verification dossiers with reason-coded binding decisions.",
  },
];

export default function LandingPage() {
  const wrap = "mx-auto max-w-[1200px] px-4 md:px-8";

  return (
    <div className="relative isolate flex-1 bg-canvas text-ink selection:bg-accent/15">
      <AsciiBackdrop field={0.65}>
        <AsciiArt art={stationsSm} x={0.88} dy={0.48} depth={0.45} effect="twinkle" />
        <AsciiArt art={trace} anchor="#signal" center x={0.5} depth={0.85} effect="reveal" />
        <AsciiArt art={radar} anchor="#radar" center x={0.28} depth={0.88} effect="sweep" />
      </AsciiBackdrop>

      {/* Top Floating Glass Navigation */}
      <header className="sticky top-0 z-50 border-b border-line/80 bg-surface/85 backdrop-blur-md">
        <nav className={`${wrap} flex h-14 items-center justify-between gap-6`}>
          <Link href="/" className="flex items-center gap-2.5 group">
            <Logo size={28} />
            <span className="text-sm font-semibold tracking-tight text-ink group-hover:text-accent transition-colors">
              MeghDrishti
            </span>
          </Link>

          <div className="hidden items-center gap-6 text-xs font-medium text-sub md:flex">
            <a href="#how" className="transition-colors hover:text-ink">
              Pipeline
            </a>
            <a href="#cases" className="transition-colors hover:text-ink">
              Case Studies
            </a>
            <a href="#radar" className="transition-colors hover:text-ink">
              Spatial Fusion
            </a>
            <a href={REPO} target="_blank" rel="noreferrer" className="transition-colors hover:text-ink flex items-center gap-1.5">
              <GitFork className="h-3 w-3" /> GitHub
            </a>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/login">
              <MagneticButton strength={0.25} size="sm" variant="primary">
                Launch Console <ArrowRight className="h-3.5 w-3.5" />
              </MagneticButton>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-20 md:pt-24 md:pb-28">
        <div className={`${wrap} relative`}>
          <Reveal>
            <div className="mx-auto max-w-[800px] text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1 text-xs text-sub shadow-2xs backdrop-blur-xs mb-6">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.7)]" />
                <span>Real-time Weather Intelligence</span>
              </div>

              <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl md:text-6xl leading-[1.1]">
                Quality control for India&apos;s{" "}
                <span className="text-accent">3,100+ weather stations</span>.
              </h1>

              <p className="mx-auto mt-5 max-w-[62ch] text-base leading-relaxed text-sub md:text-lg">
                Automated verification fusing surface observations with radar, satellite, and NWP feeds to separate
                genuine severe weather from sensor faults in real time.
              </p>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link href="/login">
                  <MagneticButton strength={0.3} size="md" variant="primary">
                    Open Console <ArrowRight className="h-4 w-4" />
                  </MagneticButton>
                </Link>
                <a href="#how">
                  <MagneticButton strength={0.2} size="md" variant="secondary">
                    View QC Pipeline
                  </MagneticButton>
                </a>
              </div>
            </div>
          </Reveal>

          {/* Clean 4-Column Stat Strip */}
          <Reveal delay={0.06}>
            <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line shadow-xs lg:grid-cols-4">
              {STATS.map((s) => (
                <div key={s.label} className="bg-surface p-5 text-center transition-colors hover:bg-raised/20">
                  <div className="font-mono text-3xl font-bold tracking-tight text-ink flex items-baseline justify-center">
                    <AnimatedNumber value={s.numericValue} />
                    {s.suffix && <span>{s.suffix}</span>}
                  </div>
                  <p className="mt-1 text-xs font-medium text-sub">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          {/* Console Preview Window */}
          <Reveal delay={0.1}>
            <div className="mt-12 overflow-hidden rounded-xl border border-line bg-surface shadow-xl">
              <div className="flex items-center justify-between border-b border-[#1a2234] bg-[#090d16] px-4 py-2.5 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <span className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                    <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
                  </span>
                  <span className="ml-2 font-mono text-[11px] text-slate-400">meghdrishti.local/dashboard</span>
                </div>
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>Live Stream</span>
                </div>
              </div>
              <div className="bg-canvas p-2 md:p-3">
                <Image
                  src="/console-preview.png"
                  alt="MeghDrishti Console"
                  width={1440}
                  height={900}
                  priority
                  className="h-auto w-full rounded-lg border border-line"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Case Studies */}
      <section id="cases" className={`${wrap} scroll-mt-20 py-16 border-t border-line`}>
        <Reveal>
          <div className="max-w-[640px]">
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Severe storm vs. instrument failure.
            </h2>
            <p className="mt-2 text-sm text-sub leading-relaxed">
              Simple threshold filters fail: tight limits discard genuine cloudbursts, while loose limits let broken
              sensors trigger false heatwave advisories.
            </p>
          </div>
        </Reveal>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {EXAMPLES.map((e, i) => (
            <Reveal key={e.title} delay={i * 0.08}>
              <SpotlightCard
                spotlightColor={e.spotlight}
                spotlightSize={360}
                className={`flex h-full flex-col justify-between overflow-hidden rounded-xl border-t-2 p-0 shadow-xs ${
                  e.real ? "border-t-ok" : "border-t-crit"
                }`}
              >
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 border-b border-line pb-4">
                    <div>
                      <p className="text-xs font-semibold text-ink">{e.title}</p>
                      <div className="mt-2 flex items-baseline gap-2">
                        <span className="font-mono text-4xl font-bold tracking-tight text-ink">
                          <AnimatedNumber value={e.value} decimals={1} />
                        </span>
                        <span className="font-mono text-xs text-sub">{e.unit}</span>
                      </div>
                    </div>
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-line bg-raised text-accent">
                      <e.Icon className="h-5 w-5" strokeWidth={1.8} />
                    </div>
                  </div>

                  <ul className="mt-4 space-y-2">
                    {e.checks.map((c) => (
                      <li
                        key={c}
                        className="flex items-start gap-2.5 rounded-lg border border-line/70 bg-canvas/60 px-3 py-2 text-xs text-ink"
                      >
                        <span
                          className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-sm ${
                            e.real ? "bg-ok text-white" : "bg-crit text-white"
                          }`}
                        >
                          {e.real ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : <X className="h-2.5 w-2.5" strokeWidth={3} />}
                        </span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-line bg-raised/40 px-6 py-3.5 flex items-center justify-between gap-3 text-xs">
                  <span className="text-sub truncate">{e.summary}</span>
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold ${
                      e.real ? "border-ok/30 bg-ok/10 text-ok" : "border-crit/30 bg-crit/10 text-crit"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${e.real ? "bg-ok" : "bg-crit"}`} />
                    {e.verdict}
                  </span>
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Live Synoptic Waveform Band */}
      <section
        id="signal"
        aria-label="Live temperature trace"
        className={`${wrap} relative my-12 h-[240px] rounded-2xl border border-line bg-surface/50 overflow-hidden shadow-xs`}
      >
        <div className="flex items-center justify-between border-b border-line bg-raised/40 px-4 py-2 font-mono text-[10px] uppercase tracking-wider text-sub">
          <span>SYNOPTIC WAVEFORM MONITOR // DELHI SAFDARJUNG AWS (42182)</span>
          <span>DIURNAL THERMAL BAND · 48H TRACE</span>
        </div>
        <p className="absolute bottom-3 left-4 font-mono text-[11px] uppercase tracking-wider text-sub">
          Continuous 15-minute observation envelope · Normal diurnal oscillation verified
        </p>
      </section>

      {/* 6-Stage Ensemble Pipeline */}
      <section id="how" className="border-y border-line bg-surface/50 py-16 scroll-mt-20">
        <div className={wrap}>
          <Reveal>
            <div className="max-w-[640px]">
              <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
                6-stage verification pipeline.
              </h2>
              <p className="mt-2 text-sm text-sub leading-relaxed">
                Deterministic rules, unsupervised ML, and spatial consensus evaluate every incoming packet with explicit
                reason codes.
              </p>
            </div>
          </Reveal>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            {pipelineStages.map((s, i) => (
              <Reveal key={s.key} delay={i * 0.04}>
                <div className="flex h-full flex-col justify-between rounded-xl border border-line bg-surface p-4 transition-all duration-200 hover:border-accent/40 hover:shadow-xs">
                  <div>
                    <span className="font-mono text-[10px] font-semibold text-accent">0{i + 1}</span>
                    <h3 className="mt-2 text-sm font-semibold text-ink">{s.label}</h3>
                    <p className="mt-1 text-xs text-sub leading-relaxed">{s.detail}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Spatial & Satellite Feeds with ASCII Radar */}
      <section
        id="radar"
        className={`${wrap} relative mt-16 grid min-h-[460px] items-center gap-8 py-12 md:grid-cols-2 scroll-mt-20`}
      >
        {/* Left column reserved for the WebGL ASCII Radar sweep */}
        <div aria-hidden className="min-h-[280px] hidden md:block" />

        <Reveal>
          <SpotlightCard
            spotlightColor="rgba(29, 78, 216, 0.08)"
            spotlightSize={350}
            className="rounded-2xl border border-line bg-surface p-7 md:p-8 shadow-xs"
          >
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Four independent context layers.
            </h2>
            <p className="mt-2 text-sm text-sub leading-relaxed">
              Before classifying an anomaly as a hardware failure, MeghDrishti queries spatial consensus across multiple
              independent feeds:
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {FEEDS.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-line/80 bg-canvas/70 p-3.5 transition-colors hover:border-accent/40"
                >
                  <p className="font-mono text-xs font-semibold text-ink">{f.title}</p>
                  <p className="mt-1 text-xs text-sub leading-relaxed">{f.detail}</p>
                </div>
              ))}
            </div>
          </SpotlightCard>
        </Reveal>
      </section>

      {/* Governance & Architecture */}
      <section className="border-t border-line bg-surface/50 py-16">
        <div className={wrap}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((p, i) => {
              const Icon = p.icon;
              return (
                <Reveal key={p.title} delay={i * 0.05}>
                  <div className="rounded-xl border border-line bg-surface p-5 h-full flex flex-col justify-between">
                    <div>
                      <Icon className="h-4 w-4 text-accent" />
                      <h3 className="mt-3 text-sm font-semibold text-ink">{p.title}</h3>
                      <p className="mt-1 text-xs text-sub leading-relaxed">{p.detail}</p>
                    </div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={`${wrap} py-16`}>
        <Reveal>
          <div className="rounded-2xl border border-line bg-surface p-8 md:p-12 text-center shadow-sm">
            <h2 className="text-2xl font-bold tracking-tight text-ink md:text-3xl">
              Inspect the live national grid.
            </h2>
            <p className="mx-auto mt-2 max-w-[50ch] text-sm text-sub">
              Access the operator workbench to monitor 3,100+ stations, triage anomalies, and review sensor health.
            </p>
            <div className="mt-6 flex justify-center">
              <Link href="/login">
                <MagneticButton strength={0.3} size="md" variant="primary">
                  Launch Console <ArrowRight className="h-4 w-4" />
                </MagneticButton>
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-line bg-surface py-6 text-xs text-sub">
        <div className={`${wrap} flex flex-wrap items-center justify-between gap-4`}>
          <div className="flex items-center gap-2.5">
            <Logo size={20} />
            <span className="font-semibold text-ink">MeghDrishti</span>
            <span className="text-line">·</span>
            <span>National Weather Station Quality Control</span>
          </div>
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sub hover:text-ink transition-colors"
          >
            <GitFork className="h-3.5 w-3.5" /> GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}

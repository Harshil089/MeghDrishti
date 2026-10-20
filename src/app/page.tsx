"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import Counter from "@/components/Counter";
import MagneticButton from "@/components/MagneticButton";
import Reveal from "@/components/Reveal";
import SpotlightCard from "@/components/SpotlightCard";
import GradientText from "@/components/GradientText";
import ThemeToggle from "@/components/ThemeToggle";
import { pipelineStages } from "@/lib/mock-data";
import {
  ArrowRight,
  GitFork,
  ShieldCheck,
  CloudRain,
  Gauge,
  Layers,
  Radio,
  FileSearch,
  ClipboardCheck,
  HeartPulse,
  Sparkles,
} from "lucide-react";

// Keep the WebGL scene and its readiness-dependent controls in one client boundary.
const WeatherPipelineHero = dynamic(() => import("@/components/WeatherPipelineHero"), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[560px] sm:min-h-[660px] lg:min-h-[690px] place-items-center text-xs text-muted">
      Loading the weather pipeline…
    </div>
  ),
});

// Static facts about the system's own architecture — verifiable in the
// codebase, not live operational data. Safe to show to an unauthenticated
// visitor; nothing here is a real station's telemetry.
const ARCHITECTURE_STATS = [
  { value: 11, label: "independent QC rule checks" },
  { value: 3, label: "evidence sources fused per decision" },
  { value: 4, label: "external context sources cross-checked" },
  { value: 6, label: "possible classification outcomes" },
];

const FEATURES = [
  {
    icon: Layers,
    title: "Fusion, not a single score",
    body: "Rule checks, an Isolation Forest model, and context validation each cast an independent vote, combined into one explainable decision.",
    big: true,
  },
  {
    icon: ShieldCheck,
    title: "ExtremeEventGuard",
    body: "A genuine heatwave never gets auto-labelled a sensor fault when neighboring stations and forecasts confirm it.",
    big: false,
  },
  {
    icon: Radio,
    title: "Real-time over WebSocket",
    body: "Operators see anomalies and alert changes the moment they happen.",
    big: false,
  },
  {
    icon: FileSearch,
    title: "Every flag is explainable",
    body: "Reason codes such as TEMP_SPIKE, NEIGHBOR_MISMATCH, and GPM_CONFIRMED trace exactly why a reading was flagged, evidence attached.",
    big: true,
  },
  {
    icon: ClipboardCheck,
    title: "Human-supervised calibration",
    body: "Operator review feeds a label store for periodic recalibration. No instant retraining, everything audited.",
    big: false,
  },
  {
    icon: HeartPulse,
    title: "Independent station health",
    body: "A rolling reliability score per station, computed separately from any single anomaly decision, tracked over time.",
    big: true,
  },
];

export default function LandingPage() {
  const reduce = useReducedMotion();
  const wrap = "max-w-[1240px] mx-auto px-4 md:px-8";

  // Grid lines exist only under the cursor: track it and hand the position to CSS.
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = grid.current;
    if (!el || !window.matchMedia("(hover: hover)").matches) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty("--mx", `${e.clientX}px`);
      el.style.setProperty("--my", `${e.clientY}px`);
      el.style.opacity = "1";
    };
    const leave = () => {
      el.style.opacity = "0";
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.documentElement.addEventListener("pointerleave", leave);
    return () => {
      window.removeEventListener("pointermove", move);
      document.documentElement.removeEventListener("pointerleave", leave);
    };
  }, []);

  return (
    <div className="relative flex-1 min-h-[100dvh] overflow-x-clip">
      {/* Ambient backdrop: invisible grid revealed by a spotlight that follows the cursor. */}
      <div ref={grid} aria-hidden className="land-grid pointer-events-none fixed inset-0 -z-10 opacity-0" />

      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className={`${wrap} flex h-16 items-center justify-between`}>
          <div className="flex items-center gap-2.5">
            <Logo size={30} />
            <span className="text-sm font-semibold tracking-wide">MeghDrishti</span>
          </div>
          <nav aria-label="Sections" className="hidden md:flex items-center gap-1 text-[13px] text-muted">
            {[
              ["Features", "#features"],
              ["Why fusion", "#why"],
              ["How it works", "#how"],
            ].map(([label, href]) => (
              <a key={href} href={href} className="rounded-full px-3.5 py-1.5 transition-colors hover:bg-panel-2 hover:text-foreground">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Harshil089/MeghDrishti"
              target="_blank"
              rel="noreferrer"
              className="hidden sm:flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              <GitFork className="h-3.5 w-3.5" />
              Source
            </a>
            <ThemeToggle />
            <Link
              href="/login"
              className="rounded-full c-grad-brand px-4 py-2 text-xs font-medium text-white shadow-md shadow-accent/25 transition hover:brightness-110"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      {/* Hero: copy left, 3D pipeline right */}
      <section className="relative">
        <div className={`${wrap} grid items-center gap-4 pt-8 pb-4 md:pt-12 lg:grid-cols-[0.9fr_1.1fr]`}>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 max-w-[620px]"
          >
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-panel-2/70 px-3.5 py-1.5 text-[11px] font-mono uppercase tracking-wide text-muted backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Open-source · Smart India Hackathon 2026
            </p>
            <h1 className="mb-4 text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05]">
              Is that reading a real storm, or a <GradientText as="span">broken sensor</GradientText>?
            </h1>
            <p className="mb-6 max-w-[52ch] text-base text-muted leading-relaxed">
              MeghDrishti follows every reading through quality checks, ML and weather context, so operators can tell
              unusual weather from a sensor fault, with a reason behind every flag.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full c-grad-brand px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:brightness-110"
                >
                  Sign in to the console
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </MagneticButton>
              <MagneticButton strength={0.25}>
                <a
                  href="https://github.com/Harshil089/MeghDrishti"
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-full border border-border bg-panel-2/60 px-6 py-3 text-sm text-foreground backdrop-blur transition-colors hover:border-accent/50"
                >
                  <GitFork className="h-4 w-4" />
                  View source
                </a>
              </MagneticButton>
            </div>
          </motion.div>
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          >
            <WeatherPipelineHero />
          </motion.div>
        </div>

        {/* Architecture facts: static, not live telemetry */}
        <div className={`${wrap} pt-4 pb-2`}>
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-border overflow-hidden rounded-2xl border border-border bg-panel-2/50 backdrop-blur">
              {ARCHITECTURE_STATS.map((s) => (
                <div key={s.label} className="p-6">
                  <Counter value={s.value} className="gradient-text bg-clip-text text-5xl font-semibold text-transparent font-mono" />
                  <p className="mt-2 text-xs leading-snug text-muted">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Features */}
      <section id="features" className={`${wrap} scroll-mt-20 py-10 md:py-14`}>
        <Reveal>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-accent">Capabilities</p>
          <h2 className="mb-7 max-w-[26ch] text-3xl md:text-4xl font-semibold tracking-tight">
            Built to be <GradientText as="span">trusted with a decision</GradientText>, not just a score
          </h2>
        </Reveal>

        <div className="grid gap-4 md:grid-cols-3">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.05} className={f.big ? "md:col-span-2" : "md:col-span-1"}>
              <SpotlightCard className="h-full p-6">
                <div className="mb-4 flex items-center justify-between">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/10">
                    <f.icon className="h-5 w-5 text-accent" />
                  </span>
                  <span className="font-mono text-xs text-muted/60">{String(i + 1).padStart(2, "0")}</span>
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{f.title}</h3>
                <p className="max-w-[56ch] text-sm leading-relaxed text-muted">{f.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The core distinction */}
      <section id="why" className={`${wrap} scroll-mt-20 py-10 md:py-14`}>
        <Reveal>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-accent">Why fusion</p>
          <h2 className="mb-7 max-w-[26ch] text-3xl md:text-4xl font-semibold tracking-tight">
            One anomaly score is not enough to act on
          </h2>
        </Reveal>

        <div className="relative grid gap-4 md:grid-cols-2">
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-border bg-panel font-mono text-[11px] text-muted md:grid"
          >
            vs
          </span>
          {[
            {
              icon: CloudRain,
              title: "Likely genuine extreme",
              tag: "Real weather",
              tagClass: "border-ok/30 bg-ok/10 text-ok",
              body: "A Pune station reports 182mm of rainfall in 15 minutes. Nearby stations, NASA GPM, and the local forecast all show the same storm.",
              codes: ["RAINFALL_EXTREME", "GPM_CONFIRMED", "NEIGHBOR_CONFIRMED", "FORECAST_CONFIRMED"],
            },
            {
              icon: Gauge,
              title: "Probable sensor fault",
              tag: "Bad sensor",
              tagClass: "border-crit/30 bg-crit/10 text-crit",
              body: "A different station jumps from 31.9°C to 49.2°C in five minutes. Neighbors sit near 32°C and the forecast agrees with them, not the sensor.",
              codes: ["TEMP_SPIKE", "MODEL_HIGH_ANOMALY_SCORE", "NEIGHBOR_MISMATCH", "FORECAST_MISMATCH"],
            },
          ].map((c, i) => (
            <Reveal key={c.title} delay={0.05 + i * 0.07}>
              <SpotlightCard className="h-full p-6 md:p-7">
                <div className="mb-4 flex items-center gap-2.5">
                  <c.icon className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium text-foreground">{c.title}</span>
                  <span className={`ml-auto rounded-full border px-2.5 py-0.5 text-[10px] font-medium ${c.tagClass}`}>{c.tag}</span>
                </div>
                <p className="mb-4 text-sm leading-relaxed text-muted">{c.body}</p>
                <div className="flex flex-wrap gap-1.5">
                  {c.codes.map((code) => (
                    <span key={code} className="rounded-md border border-border bg-panel-2/70 px-2 py-1 font-mono text-[10px] text-muted">
                      {code}
                    </span>
                  ))}
                </div>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className={`${wrap} scroll-mt-20 py-10 md:py-14`}>
        <Reveal>
          <p className="mb-2 font-mono text-[11px] uppercase tracking-widest text-accent">How it works</p>
          <h2 className="mb-7 max-w-[26ch] text-3xl md:text-4xl font-semibold tracking-tight">
            Every reading passes through the same six checks
          </h2>
        </Reveal>

        <div className="rounded-3xl border border-border bg-panel-2/40 p-5 md:p-7 backdrop-blur">
          <ol className="grid gap-8 md:grid-cols-6 md:gap-3">
            {pipelineStages.map((stage, i) => (
              <Reveal key={stage.key} delay={i * 0.06}>
                <li className="land-step relative flex gap-4 md:block md:text-center">
                  <span className="relative z-10 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full border border-accent/50 bg-panel font-mono text-xs text-accent md:mx-auto">
                    {i + 1}
                  </span>
                  <div className="md:mt-4">
                    <p className="mb-1 text-[13px] font-semibold text-foreground">{stage.label}</p>
                    <p className="text-xs leading-snug text-muted">{stage.detail}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Closing CTA */}
      <section className={`${wrap} py-8 md:py-12`}>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl border border-border land-glow px-6 py-10 md:py-12 text-center">
            <div className="relative mx-auto flex max-w-[640px] flex-col items-center gap-6">
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-panel/70 px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-muted">
                <ShieldCheck className="h-3.5 w-3.5 text-accent" />
                Built for Smart India Hackathon 2026
              </span>
              <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
                Sign in to see live station data and anomaly decisions
              </h2>
              <MagneticButton>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full c-grad-brand px-6 py-3 text-sm font-medium text-white shadow-lg shadow-accent/30 transition hover:brightness-110"
                >
                  Sign in to the console
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </MagneticButton>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className={`${wrap} flex flex-wrap items-center justify-between gap-3 border-t border-border py-6 text-xs text-muted`}>
        <span className="flex items-center gap-2">
          <Logo size={20} />
          MeghDrishti
        </span>
        <a href="https://github.com/Harshil089/MeghDrishti" target="_blank" rel="noreferrer" className="transition-colors hover:text-accent">
          github.com/Harshil089/MeghDrishti
        </a>
      </footer>
    </div>
  );
}

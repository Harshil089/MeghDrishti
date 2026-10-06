"use client";

import Link from "next/link";
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

  return (
    <div className="relative flex-1 min-h-[100dvh]">
      <header className="relative h-16 flex items-center justify-between px-4 md:px-8 max-w-[1300px] mx-auto">
        <div className="flex items-center gap-2.5">
          <Logo size={32} />
          <span className="text-sm font-semibold tracking-wide">MeghDrishti</span>
        </div>
        <div className="flex items-center gap-4">
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
            className="rounded-full border border-orange-400/30 bg-orange-400/10 px-4 py-1.5 text-xs text-orange-300 hover:bg-orange-400/15 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1300px] mx-auto grid items-center gap-6 lg:grid-cols-[0.9fr_1.1fr] px-4 md:px-8 pt-8 pb-10 md:pt-12">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="max-w-[620px] relative z-10"
          >
            <p className="font-mono uppercase text-[11px] tracking-wide text-orange-400 mb-4">
              Open-source · Smart India Hackathon 2026
            </p>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] mb-5">
              Is that reading a real storm, or a{" "}
              <GradientText as="span">broken sensor</GradientText>?
            </h1>
            <p className="text-base text-muted leading-relaxed max-w-[52ch] mb-8">
              Follow a reading through quality checks, ML and weather context.
              MeghDrishti combines available evidence to help operators distinguish
              unusual weather from a sensor fault—with a reason behind every flag.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton>
                <Link
                  href="/login"
                  className="flex items-center gap-2 rounded-full bg-orange-500 text-black text-sm font-medium px-5 py-3 hover:bg-orange-400 transition-colors"
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
                  className="flex items-center gap-2 rounded-full border border-border text-sm px-5 py-3 text-foreground hover:bg-white/[0.04] transition-colors"
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

        {/* Architecture stat strip — static facts about the system, not live telemetry */}
        <div className="max-w-[1300px] mx-auto px-4 md:px-8 pb-16 md:pb-24">
          <Reveal>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {ARCHITECTURE_STATS.map((s) => (
                <div key={s.label} className="rounded-lg border border-border bg-panel-2/60 p-4">
                  <Counter value={s.value} className="text-3xl font-semibold text-orange-400 font-mono" />
                  <p className="text-[11px] text-muted mt-1 leading-snug">{s.label}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* Capabilities — asymmetric bento, single accent, no rainbow */}
      <section className="max-w-[1300px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch] mb-10">
            Built to be <GradientText as="span">trusted with a decision</GradientText>, not just a score
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-3 gap-4">
          {FEATURES.map((f, i) => (
            <Reveal
              key={f.title}
              delay={i * 0.05}
              className={f.big ? "md:col-span-2" : "md:col-span-1"}
            >
              <SpotlightCard className="h-full p-6">
                <f.icon className="h-5 w-5 text-orange-400 mb-4" />
                <h3 className="text-sm font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The core distinction */}
      <section className="max-w-[1300px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[30ch] mb-10">
            One anomaly score is not enough to act on
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4">
          <Reveal delay={0.05}>
            <SpotlightCard tone="emerald" className="h-full p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <CloudRain className="h-4 w-4 text-emerald-400" />
                <span className="text-sm font-medium text-emerald-400">Likely genuine extreme</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">
                A Pune station reports 182mm of rainfall in 15 minutes. Nearby stations, NASA GPM,
                and the local forecast all show the same storm.
              </p>
              <p className="text-xs font-mono text-emerald-400/80">
                RAINFALL_EXTREME · GPM_CONFIRMED · NEIGHBOR_CONFIRMED · FORECAST_CONFIRMED
              </p>
            </SpotlightCard>
          </Reveal>

          <Reveal delay={0.12}>
            <SpotlightCard tone="rose" className="h-full p-6 md:p-8">
              <div className="flex items-center gap-2 mb-4">
                <Gauge className="h-4 w-4 text-rose-400" />
                <span className="text-sm font-medium text-rose-400">Probable sensor fault</span>
              </div>
              <p className="text-sm text-muted leading-relaxed mb-4">
                A different station jumps from 31.9°C to 49.2°C in five minutes. Neighbors sit
                near 32°C and the forecast agrees with them, not the sensor.
              </p>
              <p className="text-xs font-mono text-rose-400/80">
                TEMP_SPIKE · MODEL_HIGH_ANOMALY_SCORE · NEIGHBOR_MISMATCH · FORECAST_MISMATCH
              </p>
            </SpotlightCard>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1300px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch] mb-10">
            Every reading passes through the same six checks
          </h2>
        </Reveal>

        <div className="flex flex-wrap gap-3">
          {pipelineStages.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 0.05}>
              <div className="flex items-center gap-3">
                <div className="rounded-lg border border-border bg-panel-2/60 px-4 py-3 min-w-[160px]">
                  <p className="text-[11px] font-mono uppercase tracking-wide text-foreground mb-1">
                    {stage.label}
                  </p>
                  <p className="text-[11px] text-muted leading-snug">{stage.detail}</p>
                </div>
                {i < pipelineStages.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-orange-400/50 shrink-0" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-[1300px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <div className="rounded-lg border border-border bg-panel-2/60 p-8 md:p-14 flex flex-col items-center text-center gap-6">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-orange-400" />
              <span className="font-mono uppercase text-[11px] tracking-wide text-muted">
                Built for Smart India Hackathon 2026
              </span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[26ch]">
              Sign in to see live station data and anomaly decisions
            </h2>
            <MagneticButton>
              <Link
                href="/login"
                className="shrink-0 flex items-center gap-2 rounded-full bg-orange-500 text-black text-sm font-medium px-5 py-3 hover:bg-orange-400 transition-colors"
              >
                Sign in to the console
                <ArrowRight className="h-4 w-4" />
              </Link>
            </MagneticButton>
          </div>
        </Reveal>
      </section>

      <footer className="max-w-[1300px] mx-auto px-4 md:px-8 py-8 flex items-center justify-between text-xs text-muted border-t border-border">
        <span>MeghDrishti</span>
        <a href="https://github.com/Harshil089/MeghDrishti" target="_blank" rel="noreferrer" className="hover:text-orange-400 transition-colors">
          github.com/Harshil089/MeghDrishti
        </a>
      </footer>
    </div>
  );
}

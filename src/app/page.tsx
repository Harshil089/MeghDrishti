"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import Counter from "@/components/Counter";
import { pipelineStages } from "@/lib/mock-data";
import { fetchLandingStats, fetchRecentDecisions, type LandingStats, type RecentDecision } from "@/lib/api";
import { useLiveData } from "@/lib/useLiveData";
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

const EMPTY_STATS: LandingStats = {
  stationsTotal: 0,
  stationsActive: 0,
  anomalies24h: 0,
  genuineExtreme24h: 0,
  probableFaults24h: 0,
  avgStationHealth: null,
  activeModels: 0,
  openAlerts: 0,
};

const FEATURES = [
  {
    icon: Layers,
    title: "Fusion, not a single score",
    body: "Rule checks, an Isolation Forest model, and context validation each cast an independent vote, combined into one explainable decision.",
  },
  {
    icon: ShieldCheck,
    title: "ExtremeEventGuard",
    body: "A genuine heatwave never gets auto-labelled a sensor fault when neighboring stations and forecasts confirm it.",
  },
  {
    icon: Radio,
    title: "Real-time over WebSocket",
    body: "Operators see anomalies and alert changes the moment they happen, not on a page refresh.",
  },
  {
    icon: FileSearch,
    title: "Every flag is explainable",
    body: "Reason codes such as TEMP_SPIKE, NEIGHBOR_MISMATCH, GPM_CONFIRMED trace exactly why a reading was flagged.",
  },
  {
    icon: ClipboardCheck,
    title: "Human-supervised calibration",
    body: "Operator review feeds a label store for periodic recalibration. No instant retraining, everything audited.",
  },
  {
    icon: HeartPulse,
    title: "Independent station health",
    body: "A rolling reliability score per station, computed separately from any single anomaly decision.",
  },
];

const classificationStyle: Record<string, string> = {
  LIKELY_GENUINE_EXTREME: "text-emerald-400 border-emerald-500/30",
  PROBABLE_SENSOR_FAULT: "text-rose-400 border-rose-500/30",
  SUSPICIOUS: "text-amber-400 border-amber-400/30",
  WATCH: "text-cyan-300 border-cyan-400/30",
  NORMAL: "text-muted border-border",
  INSUFFICIENT_CONTEXT: "text-muted border-border",
};

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const reduce = useReducedMotion();
  const stats = useLiveData(fetchLandingStats, EMPTY_STATS, 15000);
  const decisions = useLiveData(fetchRecentDecisions, [] as RecentDecision[], 15000);
  const hasStats = stats.stationsTotal > 0 || stats.anomalies24h > 0;

  return (
    <div className="flex-1 min-h-[100dvh]">
      <header className="h-16 flex items-center justify-between px-4 md:px-8 max-w-[1200px] mx-auto">
        <div className="flex items-center gap-2.5">
          <Logo size={30} />
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
          <Link
            href="/login"
            className="rounded-md border border-border px-4 py-1.5 text-xs text-foreground/90 hover:border-cyan-400/40 hover:text-cyan-300 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 pt-10 pb-16 md:pt-16 md:pb-20 grid md:grid-cols-2 gap-10 items-start">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <p className="text-xs font-mono uppercase tracking-[0.14em] text-cyan-400/80 mb-4">
            Automatic Weather Station quality intelligence
          </p>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-semibold tracking-tight leading-[1.12] mb-5">
            Is that reading a real storm, or a broken sensor?
          </h1>
          <p className="text-base text-muted leading-relaxed max-w-[54ch] mb-8">
            MeghDrishti tells the difference. Rule checks, an Isolation Forest model, and
            cross-checks against nearby stations and forecasts decide together, so a genuine
            extreme is never mistaken for a faulty probe, and a faulty probe is never mistaken
            for weather.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-md bg-cyan-400 text-black text-sm font-medium px-5 py-2.5 hover:bg-cyan-300 transition-colors"
            >
              Sign in to the console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/Harshil089/MeghDrishti"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-md border border-border text-sm px-5 py-2.5 text-foreground/80 hover:bg-white/[0.03] transition-colors"
            >
              <GitFork className="h-4 w-4" />
              View source
            </a>
          </div>
        </motion.div>

        {/* Real live decisions, not a decorative visual */}
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          className="rounded-lg border border-border bg-panel-2/60 overflow-hidden"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-xs font-mono text-muted">live decision feed</span>
            <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
              connected
            </span>
          </div>
          <div className="divide-y divide-border">
            {decisions.length === 0 && (
              <p className="px-4 py-6 text-xs text-muted">Waiting for the next processed observation.</p>
            )}
            {decisions.map((d) => (
              <div key={d.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-foreground/80">{d.stationCode}</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${
                      classificationStyle[d.classification] ?? classificationStyle.NORMAL
                    }`}
                  >
                    {d.classification}
                  </span>
                </div>
                <p className="text-[11px] text-muted font-mono">
                  confidence {(d.confidence * 100).toFixed(0)}% · {d.time}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Live stat strip */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 pb-16 md:pb-20">
        <Reveal>
          <div className="grid grid-cols-2 md:grid-cols-4 border border-border rounded-lg divide-x divide-border overflow-hidden">
            <div className="p-5">
              <Counter
                value={hasStats ? stats.stationsActive : null}
                className="text-2xl font-semibold font-mono"
              />
              <p className="text-[11px] text-muted mt-1">stations live</p>
            </div>
            <div className="p-5">
              <Counter
                value={hasStats ? stats.anomalies24h : null}
                className="text-2xl font-semibold font-mono"
              />
              <p className="text-[11px] text-muted mt-1">readings analyzed, 24h</p>
            </div>
            <div className="p-5">
              <Counter
                value={hasStats ? stats.probableFaults24h : null}
                className="text-2xl font-semibold font-mono"
              />
              <p className="text-[11px] text-muted mt-1">sensor faults caught, 24h</p>
            </div>
            <div className="p-5">
              <Counter
                value={hasStats ? stats.avgStationHealth : null}
                decimals={1}
                suffix="%"
                className="text-2xl font-semibold font-mono"
              />
              <p className="text-[11px] text-muted mt-1">average station health</p>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Capabilities */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20 border-t border-border">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch] mb-10">
            Built to be trusted with a decision, not just a score
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-x-10 gap-y-8">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.03}>
              <div className="flex gap-4">
                <f.icon className="h-4 w-4 text-cyan-400 mt-0.5 shrink-0" />
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-1">{f.title}</h3>
                  <p className="text-sm text-muted leading-relaxed">{f.body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* The core distinction */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20 border-t border-border">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[30ch] mb-10">
            One anomaly score is not enough to act on
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4">
          <Reveal delay={0.05}>
            <div className="h-full rounded-lg border border-emerald-500/25 p-6 md:p-8">
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
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="h-full rounded-lg border border-rose-500/25 p-6 md:p-8">
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
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20 border-t border-border">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch] mb-10">
            Every reading passes through the same six checks
          </h2>
        </Reveal>

        <div className="flex flex-wrap gap-3">
          {pipelineStages.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 0.03}>
              <div className="flex items-center gap-3">
                <div className="rounded-md border border-border px-4 py-3 min-w-[160px]">
                  <p className="text-sm font-medium text-foreground/90 mb-1">{stage.label}</p>
                  <p className="text-[11px] text-muted leading-snug">{stage.detail}</p>
                </div>
                {i < pipelineStages.length - 1 && (
                  <ArrowRight className="h-3.5 w-3.5 text-muted/40 shrink-0" />
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20 border-t border-border">
        <Reveal>
          <div className="rounded-lg border border-border p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-cyan-400" />
                <span className="text-xs text-muted">Built for Smart India Hackathon 2026</span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight max-w-[28ch]">
                Sign in to see live station data and anomaly decisions
              </h2>
            </div>
            <Link
              href="/login"
              className="shrink-0 flex items-center gap-2 rounded-md bg-cyan-400 text-black text-sm font-medium px-5 py-2.5 hover:bg-cyan-300 transition-colors"
            >
              Sign in to the console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex items-center justify-between text-xs text-muted border-t border-border">
        <span>MeghDrishti</span>
        <a href="https://github.com/Harshil089/MeghDrishti" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
          github.com/Harshil089/MeghDrishti
        </a>
      </footer>
    </div>
  );
}

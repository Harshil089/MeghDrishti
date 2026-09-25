"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import Logo from "@/components/Logo";
import AtmosphereCanvas from "@/components/AtmosphereCanvas";
import RadarSweepCanvas from "@/components/RadarSweepCanvas";
import { pipelineStages } from "@/lib/mock-data";
import { ArrowRight, GitFork, ShieldCheck, CloudRain, Gauge } from "lucide-react";

function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const reduce = useReducedMotion();

  return (
    <div className="flex-1 min-h-[100dvh]">
      <header className="h-16 flex items-center justify-between px-4 md:px-8 max-w-[1400px] mx-auto">
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
          <Link
            href="/login"
            className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-4 py-1.5 text-xs text-cyan-300 hover:bg-cyan-400/15 transition-colors"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 md:px-8 pt-10 pb-16 md:pt-16 md:pb-24 grid md:grid-cols-2 gap-10 items-center">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.05] mb-5">
              Is that reading a real storm, or a broken sensor?
            </h1>
            <p className="text-base text-muted leading-relaxed max-w-[52ch] mb-8">
              MeghDrishti tells the difference. Rule checks, an Isolation Forest model, and
              cross-checks against nearby stations and forecasts decide together, so a genuine
              heatwave never gets flagged as a faulty probe.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="flex items-center gap-2 rounded-full bg-cyan-400 text-black text-sm font-medium px-5 py-3 hover:bg-cyan-300 transition-colors"
              >
                Sign in to the console
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="https://github.com/Harshil089/MeghDrishti"
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-full border border-border text-sm px-5 py-3 text-foreground/80 hover:bg-white/[0.04] transition-colors"
              >
                <GitFork className="h-4 w-4" />
                View source
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={reduce ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="relative h-72 md:h-96 rounded-2xl border border-border glass overflow-hidden"
          >
            <AtmosphereCanvas />
            <div className="absolute inset-0 flex items-center justify-center">
              <RadarSweepCanvas size={180} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* The core distinction */}
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[30ch] mb-10">
            One anomaly score is not enough to act on
          </h2>
        </Reveal>

        <div className="grid md:grid-cols-2 gap-4">
          <Reveal delay={0.05}>
            <div className="h-full rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6 md:p-8">
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

          <Reveal delay={0.12}>
            <div className="h-full rounded-2xl border border-rose-500/20 bg-rose-500/[0.04] p-6 md:p-8">
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
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight max-w-[28ch] mb-10">
            Every reading passes through the same six checks
          </h2>
        </Reveal>

        <div className="flex flex-wrap gap-3">
          {pipelineStages.map((stage, i) => (
            <Reveal key={stage.key} delay={i * 0.05}>
              <div className="flex items-center gap-3">
                <div className="rounded-xl border border-border bg-panel-2/60 px-4 py-3 min-w-[160px]">
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
      <section className="max-w-[1400px] mx-auto px-4 md:px-8 py-16 md:py-24">
        <Reveal>
          <div className="rounded-2xl border border-border glass p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-cyan-300" />
                <span className="text-xs text-muted">Built for Smart India Hackathon 2026</span>
              </div>
              <h2 className="text-xl md:text-2xl font-semibold tracking-tight max-w-[28ch]">
                Sign in to see live station data and anomaly decisions
              </h2>
            </div>
            <Link
              href="/login"
              className="shrink-0 flex items-center gap-2 rounded-full bg-cyan-400 text-black text-sm font-medium px-5 py-3 hover:bg-cyan-300 transition-colors"
            >
              Sign in to the console
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <footer className="max-w-[1400px] mx-auto px-4 md:px-8 py-8 flex items-center justify-between text-xs text-muted border-t border-border">
        <span>MeghDrishti</span>
        <a href="https://github.com/Harshil089/MeghDrishti" target="_blank" rel="noreferrer" className="hover:text-foreground transition-colors">
          github.com/Harshil089/MeghDrishti
        </a>
      </footer>
    </div>
  );
}

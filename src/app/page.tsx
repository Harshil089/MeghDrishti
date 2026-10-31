"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Check, CloudRain, GitFork, Thermometer, X } from "lucide-react";
import Logo from "@/components/Logo";
import Reveal from "@/components/Reveal";
import AsciiField from "@/components/ascii/AsciiField";
import AsciiBackdrop from "@/components/ascii/AsciiBackdrop";
import AsciiArt from "@/components/ascii/AsciiArt";
import { radar, stationsSm, temperatureSm, trace } from "@/components/ascii/art";
import { pipelineStages } from "@/lib/mock-data";

const REPO = "https://github.com/Harshil089/MeghDrishti";

// Static facts about the system's own architecture, verifiable in the codebase.
// Not live telemetry: nothing on this public page is a real station's data.
const ARCHITECTURE_STATS = [
  { value: "11", label: "rule checks per reading" },
  { value: "3", label: "evidence sources fused" },
  { value: "4", label: "context feeds cross-checked" },
  { value: "6", label: "possible verdicts" },
];

// An illustrative pair, not live data: the same kind of alarming reading, two different answers.
const EXAMPLES = [
  {
    where: "Pune AWS · rainfall",
    value: "182",
    unit: "mm in 15 min",
    Icon: CloudRain,
    verdict: "Real weather",
    real: true,
    checks: ["Nearby stations saw the storm", "NASA GPM satellite rain agrees", "Forecast predicted heavy rain"],
  },
  {
    where: "Nagpur AWS · temperature",
    value: "49.2",
    unit: "°C in 5 min",
    Icon: Thermometer,
    verdict: "Sensor fault",
    real: false,
    checks: ["Neighbours sit near 32 °C", "ERA5 reanalysis disagrees", "Jumped 17 °C in one reading"],
  },
];

const primary =
  "inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-medium text-on-accent transition-colors hover:bg-accent/90";
const secondary =
  "inline-flex items-center gap-2 rounded-full border border-line bg-surface px-6 py-3 text-sm font-medium text-ink transition-colors hover:border-accent/40";

const LON = ["68°E", "72°E", "76°E", "80°E", "84°E", "88°E", "92°E", "96°E"];
const LAT = ["32°N", "28°N", "24°N", "20°N", "16°N", "12°N", "08°N"];

/** Lat/long ticks around the hero field, the way a synoptic chart is framed (India's extent). */
function ChartFrame() {
  const tick = "font-mono text-[10px] tracking-wider text-sub";
  const pill = "rounded bg-canvas/90 px-1";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      <div className="absolute inset-x-10 top-[92px] flex justify-between">
        {LON.map((l) => (
          <span key={l} className={`${tick} flex flex-col items-center gap-1`}>
            <span className="h-2 w-px bg-sub/50" />
            <span className={pill}>{l}</span>
          </span>
        ))}
      </div>
      <div className="absolute bottom-24 left-3 top-[140px] flex flex-col justify-between">
        {LAT.map((l) => (
          <span key={l} className={`${tick} flex items-center gap-1.5`}>
            <span className="h-px w-2 bg-sub/50" />
            <span className={pill}>{l}</span>
          </span>
        ))}
      </div>
      <div className="absolute bottom-24 right-3 top-[140px] flex flex-col justify-between">
        {LAT.map((l) => (
          <span key={l} className={`${tick} flex items-center gap-1.5`}>
            <span className={pill}>{l}</span>
            <span className="h-px w-2 bg-sub/50" />
          </span>
        ))}
      </div>
      <p className={`${tick} ${pill} absolute right-12 top-[124px] uppercase`}>Field view · synthetic cloud field, rendered live</p>
    </div>
  );
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mx-auto inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-wider text-sub">
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      {children}
    </p>
  );
}

export default function LandingPage() {
  const wrap = "mx-auto max-w-[1200px] px-4 md:px-8";

  return (
    <div className="relative isolate flex-1 bg-canvas text-ink">
      <AsciiBackdrop field={1}>
        <AsciiArt art={stationsSm} x={0.875} dy={0.52} depth={0.55} effect="twinkle" />
        <AsciiArt art={temperatureSm} anchor="#problem" x={0.12} dy={0.35} depth={0.4} effect="isotherm" />
        <AsciiArt art={trace} anchor="#signal" center x={0.5} depth={0.92} effect="reveal" />
        <AsciiArt art={radar} anchor="#radar" center x={0.3} depth={0.92} effect="sweep" />
      </AsciiBackdrop>
      <header className="sticky top-0 z-40 pt-4">
        <nav className="mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-6 rounded-full border border-line bg-surface/95 py-2 pl-3 pr-2 shadow-sm">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-sm font-semibold">MeghDrishti</span>
          </Link>
          <div className="hidden items-center gap-5 text-[13px] text-sub md:flex">
            <a href="#problem" className="hover:text-ink">The problem</a>
            <a href="#how" className="hover:text-ink">How it decides</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="hover:text-ink">Open source</a>
          </div>
          <Link href="/login" className="rounded-full bg-accent px-4 py-2 text-xs font-medium text-on-accent hover:bg-accent/90">
            Open console
          </Link>
        </nav>
      </header>

      {/* Hero: copy over a live ASCII field view, framed like a chart */}
      <section className="relative -mt-[76px] overflow-hidden pt-[76px]">
        <div className="absolute inset-x-0 top-0 h-[860px]">
          <ChartFrame />
        </div>
        <div className={`${wrap} relative pt-16 text-center md:pt-24`}>
        <Reveal>
          <Eyebrow>Smart India Hackathon 2026 · Open source</Eyebrow>
          <h1 className="mx-auto mt-6 text-5xl font-semibold leading-[1.02] tracking-tight md:text-[88px]">
            Every reading,
            <br />
            <span className="text-accent">judged.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-[60ch] text-base leading-relaxed text-sub md:text-lg">
            Weather stations get it wrong sometimes. MeghDrishti checks each value against rules, a learned model, nearby
            stations and satellites, then tells you whether it was a storm or a broken sensor.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/login" className={primary}>
              Open the console <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#how" className={secondary}>
              Read how it decides
            </a>
          </div>
        </Reveal>
        <Reveal delay={0.1}>
          <div className="mx-auto mt-14 max-w-[1100px] rounded-[28px] border border-line bg-surface p-2.5 shadow-[0_24px_60px_-28px_rgb(15_26_46/0.25)]">
            <Image
              src="/console-preview.png"
              alt="The MeghDrishti console overview: a station's conditions, fleet trust score, stations needing attention and the decision feed"
              width={1440}
              height={900}
              priority
              className="h-auto w-full rounded-[20px] border border-line"
            />
          </div>
        </Reveal>
        </div>
      </section>

      {/* The problem */}
      <section id="problem" className={`${wrap} scroll-mt-24 pt-28 text-center`}>
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            Two alarming readings.
            <br />
            Only one is real.
          </h2>
        </Reveal>
        <div className="mt-12 grid gap-5 text-left md:grid-cols-2">
          {EXAMPLES.map((e, i) => (
            <Reveal key={e.where} delay={i * 0.08}>
              <article className="c-card h-full rounded-3xl p-8">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-sub">{e.where}</p>
                    <p className="mt-1 flex items-baseline gap-2">
                      <span className="text-6xl font-light tracking-tight">{e.value}</span>
                      <span className="text-sm text-sub">{e.unit}</span>
                    </p>
                  </div>
                  <e.Icon className="h-16 w-16 text-accent" strokeWidth={1.2} aria-hidden />
                </div>
                <ul className="mt-6 space-y-2">
                  {e.checks.map((c) => (
                    <li key={c} className="flex items-center gap-3 rounded-xl bg-raised px-4 py-2.5 text-sm">
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${e.real ? "bg-ok/15 text-ok" : "bg-crit/15 text-crit"}`}>
                        {e.real ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs uppercase tracking-wider text-sub">Verdict</span>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-raised px-2.5 py-1 text-xs font-medium">
                    <span className={`h-1.5 w-1.5 rounded-full ${e.real ? "bg-ok" : "bg-crit"}`} />
                    {e.verdict}
                  </span>
                </p>
              </article>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-xs text-sub">Illustrative example, not live station data.</p>
      </section>

      {/* Open band: a real station's trace is drawn live here by the backdrop. */}
      <section id="signal" aria-label="Live temperature trace" className={`${wrap} relative mt-24 h-[340px]`}>
        <p className="absolute bottom-0 left-4 font-mono text-[11px] uppercase tracking-wider text-sub md:left-8">
          Delhi Safdarjung AWS · temperature · 48 h inside its normal band
        </p>
      </section>

      {/* How it decides */}
      <section id="how" className={`${wrap} scroll-mt-24 pt-28 text-center`}>
        <Reveal>
          <Eyebrow>How it decides</Eyebrow>
          <h2 className="mt-5 text-4xl font-semibold tracking-tight md:text-5xl">
            The same checks, every reading,
            <br />
            always with a reason.
          </h2>
        </Reveal>
        <ol className="relative mt-14 grid gap-8 md:grid-cols-6 md:gap-4">
          <span aria-hidden className="absolute left-[8%] right-[8%] top-7 hidden border-t border-dashed border-accent/40 md:block" />
          {pipelineStages.map((s, i) => (
            <Reveal key={s.key} delay={i * 0.05}>
              <li className="relative flex flex-col items-center gap-3">
                <span
                  className={`grid h-14 w-14 place-items-center rounded-full border font-mono text-sm ${
                    i === pipelineStages.length - 1 ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="text-[15px] font-semibold">{s.label}</span>
                <span className="max-w-[22ch] text-xs leading-snug text-sub">{s.detail}</span>
              </li>
            </Reveal>
          ))}
        </ol>
      </section>

      {/* Stats */}
      <section className={`${wrap} pt-24`}>
        <Reveal>
          <div className="c-card grid grid-cols-2 divide-line rounded-3xl md:grid-cols-4 md:divide-x">
            {ARCHITECTURE_STATS.map((s) => (
              <div key={s.label} className="px-8 py-8">
                <p className="text-6xl font-light tracking-tight text-accent">{s.value}</p>
                <p className="mt-2 text-sm text-sub">{s.label}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* Open band: the radar scope is drawn live here by the backdrop, copy on the right. */}
      <section id="radar" className={`${wrap} relative mt-24 grid min-h-[520px] items-center md:grid-cols-2`}>
        <div aria-hidden />
        <Reveal>
          <div className="max-w-[44ch]">
            <Eyebrow>Context, not guesswork</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">Radar, satellites and neighbours, checked on every flag.</h2>
            <p className="mt-4 text-base leading-relaxed text-sub">
              Before a reading is called a fault, MeghDrishti looks outward: what nearby stations saw, what NASA GPM and ERA5 recorded, and
              what the forecast expected.
            </p>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-wider text-sub">Radar PPI · illustrative</p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section id="cta" className={`${wrap} py-24`}>
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-accent px-6 py-16 text-center text-on-accent md:py-20">
            <AsciiField field="#ffffff" line="#ffffff" clear={0.85} strength={0.4} parallax={0.1} />
            <div className="relative">
            <h2 className="text-4xl font-semibold tracking-tight md:text-5xl">Trust your stations again.</h2>
            <p className="mt-4 text-base opacity-90">Sign in to see live verdicts across your network.</p>
            <Link href="/login" className="mt-8 inline-flex items-center gap-2 rounded-full bg-white px-7 py-3.5 text-sm font-semibold text-accent hover:bg-white/90">
              Open the console <ArrowRight className="h-4 w-4" />
            </Link>
            </div>
          </div>
        </Reveal>
      </section>

      <footer className={`${wrap} flex flex-wrap items-center justify-between gap-3 border-t border-line py-8 text-xs text-sub`}>
        <span className="flex items-center gap-2">
          <Logo size={20} /> MeghDrishti · built for IMD weather networks
        </span>
        <a href={REPO} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 hover:text-ink">
          <GitFork className="h-3.5 w-3.5" /> github.com/Harshil089/MeghDrishti
        </a>
      </footer>
    </div>
  );
}

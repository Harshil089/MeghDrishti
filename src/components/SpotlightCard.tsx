"use client";

import { useRef } from "react";
import type { ReactNode, MouseEvent } from "react";

// One surface; tone keys are kept so existing callers still type-check.
const SURFACE = {
  default: "border-border glass",
  emerald: "border-border glass",
  rose: "border-border glass",
} as const;

/** Card with a cursor-tracked radial glow on the border (React Bits
 * "spotlight card" pattern). Plain CSS custom properties + a radial-gradient
 * overlay — no animation library needed, and the glow only activates on
 * pointer hover so it's inert (and inexpensive) on touch devices. */
export default function SpotlightCard({
  children,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  className?: string;
  tone?: keyof typeof SURFACE;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMouseMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--spotlight-x", `${e.clientX - rect.left}px`);
    el.style.setProperty("--spotlight-y", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`spotlight-card relative rounded-2xl border overflow-hidden transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[0_18px_40px_-24px_var(--c-accent)] ${SURFACE[tone]}`}
    >
      <div className="spotlight-card__glow pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300" />
      {/* consumer's className (padding, flex layout, etc.) belongs here, not
          on the shell above — it needs to apply to the actual content, and
          this div is what sits above the glow overlay (z-stacking). */}
      <div className={`relative ${className}`}>{children}</div>
    </div>
  );
}

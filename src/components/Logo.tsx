"use client";

import { useId } from "react";

export default function Logo({ size = 36 }: { size?: number }) {
  const uid = useId().replace(/:/g, "");
  const bg = `bg-${uid}`;

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="MeghDrishti logo">
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#fb923c" />
        </linearGradient>
      </defs>

      <rect width="64" height="64" rx="16" fill={`url(#${bg})`} />

      {/* signal spike — flat reading breaking into one anomaly */}
      <path
        d="M12,40 L20,38 L27,42 L34,36 L40,18 L46,32 L52,28"
        fill="none"
        stroke="#0b1220"
        strokeWidth={4.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={40} cy={18} r={7.5} fill="#fb7185" opacity={0.28} />
      <circle cx={40} cy={18} r={3.4} fill="#ffffff" stroke="#0b1220" strokeWidth={1.2} />
    </svg>
  );
}

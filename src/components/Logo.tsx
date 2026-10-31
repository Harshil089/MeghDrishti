/** MeghDrishti Institutional Emblem: Synoptic coordinate reticle + precision telemetry pulse. */
export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="MeghDrishti National AWS Quality Control Emblem" className="shrink-0">
      <rect width="32" height="32" rx="6" fill="var(--c-accent)" />
      <rect x="1" y="1" width="30" height="30" rx="5" fill="none" stroke="#ffffff" strokeOpacity="0.22" strokeWidth="1" />
      {/* Subtle synoptic reticle & horizon */}
      <circle cx="16" cy="16" r="10" fill="none" stroke="#ffffff" strokeOpacity="0.2" strokeWidth="1" strokeDasharray="2 2" />
      <line x1="5" y1="16" x2="27" y2="16" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
      {/* Precision verified telemetry waveform */}
      <path
        d="M5.5 19.5L9.5 18.5L12.5 20.5L15.5 16.5L18.5 8.5L21.5 16.5L24 14.5L26.5 14.5"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Anomaly verification node */}
      <circle cx="18.5" cy="8.5" r="2" fill="#ff9933" stroke="#ffffff" strokeWidth="1" />
    </svg>
  );
}

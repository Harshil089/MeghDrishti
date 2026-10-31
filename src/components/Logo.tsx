/** MeghDrishti mark: a flat accent tile with a reading trace breaking into one spike. */
export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" role="img" aria-label="MeghDrishti logo">
      <rect width="28" height="28" rx="8" fill="var(--c-accent)" />
      <path
        d="M6 17.5L9.5 16.5L12.5 18.5L15.5 15.5L18 8.5L20.5 14.5L23 13"
        fill="none"
        stroke="#fff"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

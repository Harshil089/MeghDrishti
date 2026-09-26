import Counter from "@/components/Counter";
import SpotlightCard from "@/components/SpotlightCard";

const toneMap = {
  emerald: { text: "text-emerald-400", ring: "from-emerald-400/20" },
  rose: { text: "text-rose-400", ring: "from-rose-400/20" },
  cyan: { text: "text-cyan-300", ring: "from-cyan-400/20" },
  amber: { text: "text-amber-400", ring: "from-amber-400/20" },
} as const;

const NUMERIC = /^-?\d+(\.\d+)?$/;

export default function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof toneMap;
}) {
  const t = toneMap[tone];
  // Only "Active alerts: 3" etc. animate as a count-up — "Healthy"/"Degraded"
  // style values render as plain text, Counter can't meaningfully animate those.
  const numeric = NUMERIC.test(value.trim()) ? Number(value) : null;

  return (
    <SpotlightCard className="p-4">
      <div className={`absolute -top-8 -right-8 h-24 w-24 rounded-full bg-gradient-to-br ${t.ring} to-transparent blur-xl`} />
      <p className="text-xs text-muted mb-2">{label}</p>
      {numeric !== null ? (
        <Counter value={numeric} className={`text-2xl font-semibold ${t.text}`} />
      ) : (
        <p className={`text-2xl font-semibold ${t.text}`}>{value}</p>
      )}
      <p className="text-xs text-muted mt-1">{sub}</p>
    </SpotlightCard>
  );
}

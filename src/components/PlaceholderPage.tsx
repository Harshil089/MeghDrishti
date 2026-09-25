import type { LucideIcon } from "lucide-react";
import Topbar from "@/components/Topbar";

export default function PlaceholderPage({
  title,
  icon: Icon,
  description,
  children,
}: {
  title: string;
  icon: LucideIcon;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <>
      <Topbar title={title} />
      <main className="flex-1 p-4 md:p-6 space-y-6">
        <div className="glass rounded-xl p-8 flex flex-col items-center text-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
            <Icon className="h-6 w-6 text-cyan-300" />
          </div>
          <p className="text-sm text-muted max-w-md">{description}</p>
          <span className="text-[11px] uppercase tracking-widest text-orange-400/80 border border-orange-400/20 rounded-full px-3 py-1 mt-1">
            Coming in full MVP
          </span>
        </div>
        {children}
      </main>
    </>
  );
}

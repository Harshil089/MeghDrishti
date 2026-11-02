import React from "react";
import { SpotlightCard } from "@/components/ui/spotlight-card";
import { MagneticButton } from "@/components/ui/magnetic-button";
import { ArrowUpRight, Activity, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { motionTransitions } from "./motion-tokens";

export function EasyUIDemo() {
  return (
    <div className="min-h-screen bg-[#151515] text-[#F5F5F5] p-8 flex items-center justify-center">
      <SpotlightCard
        spotlightColor="rgba(255, 255, 255, 0.08)"
        className="w-full max-w-lg p-6 bg-[#202020] border border-[#2E2E2E] rounded-2xl shadow-xl flex flex-col gap-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs uppercase tracking-wider font-semibold text-[#A3A3A3]">
              System Live
            </span>
          </div>
          <span className="text-xs text-[#737373] bg-[#242424] px-2.5 py-1 rounded-full border border-[#2E2E2E]">
            v2.4.0
          </span>
        </div>

        <div>
          <h2 className="text-xl font-medium tracking-tight text-[#F5F5F5]">
            Telemetry Node Matrix
          </h2>
          <p className="text-sm text-[#A3A3A3] mt-1 leading-relaxed">
            Real-time sensory ingest and distributed edge telemetry with spring-physics feedback.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-3.5 bg-[#242424] rounded-xl border border-[#2E2E2E] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#A3A3A3] text-xs">
              <Activity className="w-3.5 h-3.5 text-blue-400" />
              <span>Sensory Packets</span>
            </div>
            <span className="text-lg font-semibold text-[#F5F5F5]">142.8 k/s</span>
          </div>

          <div className="p-3.5 bg-[#242424] rounded-xl border border-[#2E2E2E] flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#A3A3A3] text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Grid Health</span>
            </div>
            <span className="text-lg font-semibold text-emerald-400">Optimal</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#2E2E2E]">
          <motion.button
            whileTap={{ scale: 0.96 }}
            transition={motionTransitions.springSnappy}
            className="px-4 py-2 text-sm text-[#A3A3A3] hover:text-[#F5F5F5] transition-colors"
          >
            Dismiss
          </motion.button>
          <MagneticButton
            strength={0.3}
            className="px-4 py-2 bg-[#F5F5F5] text-[#151515] hover:bg-white text-sm font-medium rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
          >
            Inspect Node
            <ArrowUpRight className="w-4 h-4" />
          </MagneticButton>
        </div>
      </SpotlightCard>
    </div>
  );
}

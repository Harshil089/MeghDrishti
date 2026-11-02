"use client";

import React, { useEffect } from "react";
import { motion, useSpring, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";

export interface AnimatedNumberProps {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  stiffness?: number;
  damping?: number;
  mass?: number;
  useGrouping?: boolean;
  compact?: boolean;
  className?: string;
}

const DigitColumn: React.FC<{
  digit: string;
  stiffness?: number;
  damping?: number;
  mass?: number;
}> = ({ digit, stiffness = 160, damping = 18, mass = 0.8 }) => {
  const isNumber = !isNaN(parseInt(digit, 10));
  const numValue = isNumber ? parseInt(digit, 10) : 0;

  const spring = useSpring(numValue, {
    stiffness,
    damping,
    mass,
  });

  const y = useTransform(spring, (current) => `-${current * 10}%`);

  useEffect(() => {
    spring.set(numValue);
  }, [spring, numValue]);

  if (!isNumber) {
    return <span className="inline-block">{digit}</span>;
  }

  return (
    <span className="inline-block relative overflow-hidden h-[1.15em] leading-[1.15em] w-[0.58em] text-center font-mono tabular-nums align-baseline">
      <motion.span style={{ y }} className="flex flex-col select-none">
        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <span key={n} className="h-[1.15em] flex items-center justify-center">
            {n}
          </span>
        ))}
      </motion.span>
    </span>
  );
};

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  stiffness = 160,
  damping = 18,
  mass = 0.8,
  useGrouping = true,
  compact = false,
  className,
}) => {
  let formattedString = "";

  if (compact) {
    const formatter = new Intl.NumberFormat("en-US", {
      notation: "compact",
      compactDisplay: "short",
      maximumFractionDigits: decimals,
    });
    formattedString = formatter.format(value);
  } else {
    formattedString = value.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping,
    });
  }

  const characters = formattedString.split("");

  return (
    <span className={cn("inline-flex items-baseline font-mono tabular-nums", className)}>
      {prefix && <span className="mr-0.5">{prefix}</span>}
      <span className="inline-flex items-center">
        {characters.map((char, index) => (
          <DigitColumn
            key={`${index}-${char}`}
            digit={char}
            stiffness={stiffness}
            damping={damping}
            mass={mass}
          />
        ))}
      </span>
      {suffix && <span className="ml-0.5">{suffix}</span>}
    </span>
  );
};

export default AnimatedNumber;

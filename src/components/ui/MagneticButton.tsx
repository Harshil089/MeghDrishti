"use client";

import React, { useRef, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";

export interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  strength?: number;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
}

export const MagneticButton: React.FC<MagneticButtonProps> = ({
  children,
  strength = 0.35,
  variant = "primary",
  size = "md",
  className,
  glow = true,
  onClick,
  ...props
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const springX = useSpring(0, { stiffness: 280, damping: 20 });
  const springY = useSpring(0, { stiffness: 280, damping: 20 });

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);

    springX.set(middleX * strength);
    springY.set(middleY * strength);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    springX.set(0);
    springY.set(0);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const variantStyles = {
    primary:
      "bg-accent text-on-accent hover:bg-accent/90 shadow-sm font-medium cursor-pointer border border-accent",
    secondary:
      "bg-surface text-ink border border-line hover:border-sub/40 hover:bg-raised cursor-pointer",
    outline:
      "bg-transparent text-ink border border-line hover:border-accent hover:bg-accent-soft cursor-pointer",
    ghost:
      "bg-transparent text-sub hover:text-ink hover:bg-raised cursor-pointer",
  };

  const sizeStyles = {
    sm: "px-3 py-1.5 text-xs rounded-md gap-1.5",
    md: "px-4 py-2 text-xs md:text-sm rounded-lg gap-2",
    lg: "px-6 py-3 text-sm md:text-base rounded-lg gap-2.5",
  };

  return (
    <motion.button
      ref={ref}
      style={{
        x: springX,
        y: springY,
      }}
      whileTap={{ scale: 0.96 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      className={cn(
        "relative inline-flex items-center justify-center font-medium transition-colors select-none focus-visible:outline-2 focus-visible:outline-accent",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...(props as any)}
    >
      {glow && isHovered && (
        <span
          className="pointer-events-none absolute -inset-1 rounded-[inherit] bg-accent/20 blur-sm -z-10"
          aria-hidden
        />
      )}
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </motion.button>
  );
};

export default MagneticButton;

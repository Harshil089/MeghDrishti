"use client";

import { useReducedMotion } from "framer-motion";
import type { ElementType, ReactNode } from "react";

/** Animated cyan→orange gradient text (matches the Logo's own gradient) for
 * hero headlines and section titles. Reduced-motion gets the same gradient,
 * frozen — never a plain color fallback, so it still reads as branded. */
export default function GradientText({
  children,
  as: Tag = "span",
  className = "",
}: {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const Component = Tag as ElementType<{ className?: string; children?: ReactNode }>;
  return (
    <Component
      className={`gradient-text bg-clip-text text-transparent ${reduce ? "" : "gradient-text--animated"} ${className}`}
    >
      {children}
    </Component>
  );
}

import type { Transition } from "framer-motion";

/**
 * EasyUI Motion Design Tokens
 * Philosophy: Soft + physical + immediate + controlled
 */
export const motionTransitions = {
  // Gentle fluid transitions (for tabs, smooth accordion, dialog fades)
  springGentle: {
    type: "spring",
    stiffness: 170,
    damping: 26,
    mass: 0.9,
  } as Transition,

  // Smooth standard motion (cards, panels)
  springSmooth: {
    type: "spring",
    stiffness: 200,
    damping: 28,
    mass: 0.85,
  } as Transition,

  // Snappy responsive feedback (buttons, badges, indicators)
  springSnappy: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.5,
  } as Transition,

  // Morphing shared layout (layoutId pills, sliding indicators)
  springMorph: {
    type: "spring",
    stiffness: 240,
    damping: 30,
    mass: 0.9,
  } as Transition,
};

---
name: easyui-design
description: >-
  Design and build tactile, micro-animated React and Next.js interfaces using EasyUI's component design system,
  official shadcn registry (Surajmaurya1/easyui), Framer Motion spring physics, and dark neutral Claude-style aesthetics.
  Use when creating, styling, or animating UI components, landing pages, interactive cards, telemetry feeds, or spring-based navigation.
---

# EasyUI Design Skill

EasyUI is a modern collection of micro-animated, tactile React components distributed via the official **shadcn GitHub Registry** (`Surajmaurya1/easyui`). It blends Apple HIG spring physics with Claude's dark neutral aesthetic for interfaces that feel responsive and alive.

---

## 1. Quick Component Installation

Install any component directly into any React/Next.js project with shadcn CLI:

```bash
npx shadcn@latest add Surajmaurya1/easyui/<component-name>
```

### Popular Components

```bash
# Proximity & Magnetism
npx shadcn@latest add Surajmaurya1/easyui/magnetic-button
npx shadcn@latest add Surajmaurya1/easyui/spotlight-card

# Navigation & Menus
npx shadcn@latest add Surajmaurya1/easyui/glass-navbar
npx shadcn@latest add Surajmaurya1/easyui/command-menu
npx shadcn@latest add Surajmaurya1/easyui/animated-tabs

# Telemetry, Data & Feedback
npx shadcn@latest add Surajmaurya1/easyui/activity-feed
npx shadcn@latest add Surajmaurya1/easyui/animated-number
npx shadcn@latest add Surajmaurya1/easyui/batch-gesture-tray
npx shadcn@latest add Surajmaurya1/easyui/notification-stack
```

> **Complete Catalog**: See the [EasyUI Component Registry Catalog](./references/registry-catalog.md) for all 130+ components.

---

## 2. Core Aesthetic & Color System

EasyUI avoids harsh pitch-black backgrounds (`#000000`) in favor of soft, refined dark neutral charcoals:

| Role | HEX | Tailwind | Usage |
| :--- | :--- | :--- | :--- |
| **Canvas / Background** | `#151515` | `bg-[#151515]` | Page body, stage, section canvas |
| **Surface (Cards)** | `#202020` | `bg-[#202020]` | Cards, containers, modals, preview boxes |
| **Surface Raised** | `#242424` | `bg-[#242424]` | Inputs, secondary buttons, active tabs |
| **Surface Hover** | `#262626` | `hover:bg-[#262626]` | Hover state on rows, buttons, list items |
| **Primary Text** | `#F5F5F5` | `text-[#F5F5F5]` | Headings, active values, primary labels |
| **Secondary Text** | `#A3A3A3` | `text-[#A3A3A3]` | Subtitles, descriptions, inactive states |
| **Muted / Hint Text** | `#737373` | `text-[#737373]` | Keyboard shortcuts, metadata, disabled text |
| **Default Border** | `#2E2E2E` | `border-[#2E2E2E]` | Card outlines, dividers, subtle separators |
| **Accent / Focus** | `#E5E5E5` | `border-[#E5E5E5]` | Focus rings, active indicator pills |

---

## 3. Framer Motion Spring Physics

Never use linear or abrupt easing curves for interactive elements. EasyUI uses critically-damped and slightly underdamped springs (see [Motion Tokens](./examples/motion-tokens.ts)):

```typescript
import { Transition } from "framer-motion";

export const motionTransitions = {
  // Snappy: Buttons, hover indicators, dock icons (~200ms settle)
  springSnappy: {
    type: "spring",
    stiffness: 380,
    damping: 30,
    mass: 0.5,
  } as Transition,

  // Smooth: Cards, drawers, standard interactive transitions (~350ms)
  springSmooth: {
    type: "spring",
    stiffness: 200,
    damping: 28,
    mass: 0.85,
  } as Transition,

  // Gentle: Accordions, tabs, large dialog fades (~400ms, no overshoot)
  springGentle: {
    type: "spring",
    stiffness: 170,
    damping: 26,
    mass: 0.9,
  } as Transition,

  // Morph: Shared layoutId, sliding highlight pills
  springMorph: {
    type: "spring",
    stiffness: 220,
    damping: 32,
    mass: 1.0,
  } as Transition,
};
```

---

## 4. Key Design Patterns

### Radial Spotlight Card
Cursor-tracking radial glow that follows the pointer across card surfaces:
```tsx
import { SpotlightCard } from "@/components/ui/spotlight-card";

<SpotlightCard
  spotlightColor="rgba(255, 255, 255, 0.08)"
  className="p-6 bg-[#202020] border border-[#2E2E2E] rounded-2xl"
>
  <h3 className="text-[#F5F5F5] font-medium text-base">Telemetry Card</h3>
  <p className="text-[#A3A3A3] text-sm mt-1">Tactile glow tracks pointer proximity.</p>
</SpotlightCard>
```

### Magnetic Pull Button
Spring-physic pointer attraction when hovering within proximity:
```tsx
import { MagneticButton } from "@/components/ui/magnetic-button";

<MagneticButton strength={0.35} className="px-4 py-2 bg-[#242424] hover:bg-[#2A2A2A] text-[#F5F5F5] rounded-xl border border-[#2E2E2E]">
  Deploy Application
</MagneticButton>
```

### Floating Glass Navigation
Translucent blurred surface with responsive spring indicator:
```tsx
<nav className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 bg-[#151515]/80 backdrop-blur-md border border-[#2E2E2E] rounded-full shadow-2xl">
  {/* Nav items */}
</nav>
```

---

## 5. Design Checklist
When creating or modifying components with EasyUI:
1. **Background Contrast**: Ensure canvas is `#151515` and containers are `#202020` or `#242424`.
2. **Spring Damping**: Ensure `type: "spring"` with `damping >= 25` to avoid cartoonish bouncing.
3. **Borders**: Thin, crisp 1px borders (`border-[#2E2E2E]`) rather than heavy drop shadows alone.
4. **Micro-Feedback**: Provide active scale down (e.g. `whileTap={{ scale: 0.97 }}`) on all clickable controls.
5. **Progressive Disclosure**: For full design system specs and token tables, reference [Design System Specification](./references/design-system.md).

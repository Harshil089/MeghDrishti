"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    setLight(document.documentElement.classList.contains("light"));
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    document.documentElement.classList.toggle("light", next);
    localStorage.setItem("meghdrishti-theme", next ? "light" : "dark");
    window.dispatchEvent(new Event("themechange"));
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="group relative grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-border bg-panel-2/60 text-muted transition-all hover:border-accent/50 hover:text-accent active:scale-90"
    >
      <span key={String(light)} className="grid place-items-center animate-[theme-spin_450ms_cubic-bezier(0.34,1.56,0.64,1)]">
        {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </span>
    </button>
  );
}

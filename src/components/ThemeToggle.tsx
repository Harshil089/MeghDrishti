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
      className="rounded-lg border border-border p-2 text-muted hover:text-foreground transition-colors"
    >
      {light ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
    </button>
  );
}

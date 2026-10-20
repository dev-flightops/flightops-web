"use client";

import { cn } from "@/lib/utils";

import { useTheme } from "./theme-provider";

/**
 * DARK | LIGHT — a two-segment control in ForeFlight's idiom: uppercase,
 * tracked, near-square corners, the current mode filled (#78). Sits in the top
 * bar and the landing page's nav, both dark islands.
 */
export function ThemeSwitch({ className }: { className?: string }) {
  const { mode, setMode } = useTheme();
  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={cn("inline-flex h-7 items-stretch overflow-hidden rounded-md border border-white/25", className)}
    >
      {(["dark", "light"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => setMode(m)}
          className={cn(
            "px-2.5 text-[0.65rem] font-semibold uppercase tracking-[0.12em] transition-colors",
            "focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white",
            mode === m ? "bg-white text-chrome" : "text-white/80 hover:text-white",
          )}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

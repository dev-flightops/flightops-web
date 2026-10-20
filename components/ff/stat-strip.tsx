import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Figures across the top of a page (#79), as the Flight Following board
 * shows them: the number large in the display face, a capitals label under
 * it, a thin rule to its left in the colour that says what it is. It
 * replaces grids of stat tiles — the figures are the content, not cards.
 */
export function StatStrip({
  label,
  children,
  className,
}: {
  /** What the figures are, for assistive technology ("Flight summary"). */
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn("mb-6 grid grid-cols-2 gap-x-8 gap-y-4 sm:flex sm:flex-wrap", className)}
    >
      {children}
    </div>
  );
}

export type StatTone = "green" | "yellow" | "red" | "blue" | "orange" | "purple" | "teal" | "gray" | "brand" | "neutral";

const RULE: Record<StatTone, string> = {
  green: "border-status-green",
  yellow: "border-status-yellow",
  red: "border-status-red",
  blue: "border-status-blue",
  orange: "border-status-orange",
  purple: "border-status-purple",
  teal: "border-status-teal",
  gray: "border-status-gray",
  brand: "border-primary",
  neutral: "border-input",
};

export function Stat({
  value,
  label,
  tone = "neutral",
  hint,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: StatTone;
  /** A line under the label: a unit, a comparison, a date. */
  hint?: ReactNode;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col border-l-2 pl-3", RULE[tone])}>
      <span className="font-display text-[1.75rem] font-extrabold leading-none tabular-nums text-foreground">
        {value}
      </span>
      <span className="eyebrow mt-1.5">{label}</span>
      {hint ? <span className="mt-0.5 text-xs text-muted-foreground">{hint}</span> : null}
    </span>
  );
}

import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The "stat tile" that lives in the row of headline numbers at the top
 * of every dashboard view, ported from the legacy `stat_tile` macro:
 *
 *   ┌──────────────┐
 *   │      8       │  ← 3xl bold value, color overridable
 *   │   Airborne   │  ← tiny uppercase label
 *   │  in flight   │  ← optional secondary line
 *   └──────────────┘
 *
 * `tone` picks the value color; `default` keeps it neutral foreground.
 * Passing `href` makes the tile a `<Link>` so the user can click through
 * to the underlying detail view (e.g. "8 Airborne" → /following/?status=airborne).
 *
 * Distinct from `StatCard` (the small icon-centred summary card used on
 * the dispatcher list view). Dashboards use the bigger, mono-numeric
 * `StatTile`; lighter pages use `StatCard`.
 */

type StatTileTone = "default" | "blue" | "green" | "yellow" | "orange" | "red" | "muted";

const VALUE_TONE: Record<StatTileTone, string> = {
  default: "text-foreground",
  blue:    "text-status-blue",
  green:   "text-status-green",
  yellow:  "text-status-yellow",
  orange:  "text-status-orange",
  red:     "text-status-red",
  muted:   "text-muted-foreground/60",
};

interface StatTileProps {
  value: string | number;
  label: string;
  sub?: string;
  tone?: StatTileTone;
  href?: string;
}

export function StatTile({ value, label, sub, tone = "default", href }: StatTileProps) {
  const content = (
    <>
      <div className={cn(
        "font-mono text-3xl font-bold tabular-nums leading-none",
        VALUE_TONE[tone],
      )}>
        {value}
      </div>
      <div className="mt-2 text-xs font-normal text-muted-foreground">
        {label}
      </div>
      {sub && (
        <div className="mt-1 text-[0.65rem] text-muted-foreground/70">
          {sub}
        </div>
      )}
    </>
  );

  const className = cn(
    "rounded-xl border border-border bg-card p-4 text-center transition-colors",
    href && "hover:border-primary/30 hover:bg-card/80 cursor-pointer",
  );

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

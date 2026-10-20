import Link from "next/link";

import { cn } from "@/lib/utils";

/**
 * The "stat tile" that lives in the row of headline numbers at the top
 * of every dashboard view, ported from the legacy `stat_tile` macro:
 *
 *   │ 8            ← the figure, in the display face
 *   │ AIRBORNE     ← capitals label
 *   │ in flight    ← optional secondary line
 *
 * Since #82 it is a figure, not a card: a 2px rule to its left in the
 * tile's tone, as the Flight Following stats are drawn.
 * Passing `href` makes the tile a `<Link>` so the user can click through
 * to the underlying detail view (e.g. "8 Airborne" → /following/?status=airborne).
 *
 * Distinct from `StatCard` (the small icon-centred summary card used on
 * the dispatcher list view). Dashboards use the bigger, mono-numeric
 * `StatTile`; lighter pages use `StatCard`.
 */

type StatTileTone =
  | "default"
  | "blue"
  | "green"
  | "yellow"
  | "orange"
  | "red"
  | "purple"
  | "muted";

/** The tone is the rule's colour (#82), as the app's stat strips draw a
 *  figure; the number stays in the text colour so it reads at full
 *  contrast. `muted` marks a figure that is not wired yet. */
const RULE_TONE: Record<StatTileTone, string> = {
  default: "border-input",
  blue:    "border-status-blue",
  green:   "border-status-green",
  yellow:  "border-status-yellow",
  orange:  "border-status-orange",
  red:     "border-status-red",
  purple:  "border-status-purple",
  muted:   "border-input",
};

/**
 * Value size. `large` (default) is the headline figure on the top row;
 * `small` is the money figure on the financial row, keeping legacy
 * peregrineflight's two tiers.
 */
type StatTileSize = "large" | "small";

const VALUE_SIZE: Record<StatTileSize, string> = {
  large: "text-[1.75rem]",
  small: "text-xl",
};

interface StatTileProps {
  value: string | number;
  label: string;
  sub?: string;
  tone?: StatTileTone;
  size?: StatTileSize;
  href?: string;
}

export function StatTile({
  value,
  label,
  sub,
  tone = "default",
  size = "large",
  href,
}: StatTileProps) {
  const content = (
    <>
      <span
        className={cn(
          "font-display font-extrabold leading-none tabular-nums",
          VALUE_SIZE[size],
          tone === "muted" ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {value}
      </span>
      <span className="eyebrow mt-1.5">{label}</span>
      {sub && <span className="mt-0.5 text-xs text-muted-foreground">{sub}</span>}
    </>
  );

  const className = cn(
    "flex min-w-0 flex-col border-l-2 py-1 pl-3 transition-colors",
    RULE_TONE[tone],
    href && "cursor-pointer hover:bg-accent/40",
  );

  if (href) {
    return (
      <Link href={href} className={className} data-stat-tile="">
        {content}
      </Link>
    );
  }

  // `data-stat-tile` marks the figure for tests that read a tile's parts.
  return (
    <div className={className} data-stat-tile="">
      {content}
    </div>
  );
}

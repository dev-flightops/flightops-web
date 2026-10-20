import type { CurrencyStatus } from "@/lib/api/types";

/**
 * Per-status visual tokens — Spec 5 §"Cell badge colors".
 *
 *   UPCOMING       blue   "more than 30 days before early month"
 *   EARLY          teal   "in early month window"
 *   DUE THIS MONTH green  "in base month"
 *   GRACE          yellow "in grace month, X days remaining"
 *   NON-CURRENT    red    "past grace month end — hard block"
 *   NOT STARTED    gray   "no completion ever recorded"
 *
 * Kept as a single map so the grid cells, chips, and pilot-row
 * overall-status badge all render the same colors. Mapping the
 * status enum → tailwind class names is the cleanest way to keep
 * the UI in sync with the spec without smearing color literals
 * across files.
 */

export interface StatusToken {
  label: string;
  /** Compact mark — used in grid cells. A coloured capitals word behind
   *  a square marker (`.status-mark`, #80), not a tinted pill. */
  pill: string;
  /** The same mark at row size — used in the alert banner + row chips. */
  badge: string;
  /** Background tint for the row when this is the overall status. */
  rowTint: string;
}

export const STATUS_TOKENS: Record<CurrencyStatus, StatusToken> = {
  not_started: {
    label: "Not Started",
    // Nothing to say yet: plain muted capitals, no marker.
    pill: "text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
    badge: "text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
    rowTint: "",
  },
  upcoming: {
    label: "Upcoming",
    pill: "status-mark text-[0.6rem] text-status-blue",
    badge: "status-mark text-status-blue",
    rowTint: "",
  },
  early_month: {
    label: "Early",
    pill: "status-mark text-[0.6rem] text-status-teal",
    badge: "status-mark text-status-teal",
    rowTint: "",
  },
  due_this_month: {
    label: "Due This Month",
    pill: "status-mark text-[0.6rem] text-status-green",
    badge: "status-mark text-status-green",
    rowTint: "",
  },
  grace_month: {
    label: "Grace",
    pill: "status-mark text-[0.6rem] text-status-yellow",
    badge: "status-mark text-status-yellow",
    rowTint: "bg-status-yellow/[0.03]",
  },
  non_current: {
    label: "Non-Current",
    pill: "status-mark text-[0.6rem] text-status-red",
    badge: "status-mark text-status-red",
    rowTint: "bg-status-red/[0.04]",
  },
};

/** Days between a YYYY-MM-DD string and today (UTC). Used by grace
 *  cells: "GRACE — 14 days". Returns null when the date is missing. */
export function daysUntil(target: string | null): number | null {
  if (!target) return null;
  const targetDate = new Date(target + "T00:00:00Z");
  const today = new Date();
  const utcToday = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const delta = (targetDate.getTime() - utcToday) / (1000 * 60 * 60 * 24);
  return Math.floor(delta);
}

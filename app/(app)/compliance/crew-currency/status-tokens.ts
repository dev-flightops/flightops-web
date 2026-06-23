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
  /** Compact pill class — used in grid cells. */
  pill: string;
  /** Larger badge class — used in the alert banner + row chips. */
  badge: string;
  /** Background tint for the row when this is the overall status. */
  rowTint: string;
}

export const STATUS_TOKENS: Record<CurrencyStatus, StatusToken> = {
  not_started: {
    label: "Not Started",
    pill: "rounded bg-muted/40 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    badge:
      "rounded bg-muted/30 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground",
    rowTint: "",
  },
  upcoming: {
    label: "Upcoming",
    pill: "rounded bg-status-blue/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-blue",
    badge:
      "rounded bg-status-blue/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-blue",
    rowTint: "",
  },
  early_month: {
    label: "Early",
    pill: "rounded bg-status-teal/20 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-teal",
    badge:
      "rounded bg-status-teal/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-teal",
    rowTint: "",
  },
  due_this_month: {
    label: "Due This Month",
    pill: "rounded bg-status-green/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-green",
    badge:
      "rounded bg-status-green/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-green",
    rowTint: "",
  },
  grace_month: {
    label: "Grace",
    pill: "rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-yellow",
    badge:
      "rounded bg-status-yellow/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-yellow",
    rowTint: "bg-status-yellow/[0.03]",
  },
  non_current: {
    label: "Non-Current",
    pill: "rounded bg-status-red/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-status-red",
    badge:
      "rounded bg-status-red/20 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] text-status-red",
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

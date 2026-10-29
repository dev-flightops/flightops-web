import type { CurrencyStatus, PilotCurrencyCell } from "@/lib/api/types";

/**
 * Per-status visual tokens, in the GOM's five currency levels (#66; Rev
 * 12, §15): Green normal, Gold aware, Red alert, Magenta critical, Grey.
 *
 *   UPCOMING       green    normal: due in more than a month
 *   EARLY          green    normal: in the early month, done or doable
 *   DUE THIS MONTH gold     aware: in the base month
 *   GRACE          red      alert: in the grace month, X days remaining
 *   NON-CURRENT    magenta  critical: past the grace month — a hard block
 *   NOT STARTED    grey     nothing on record (the GOM's grey, no longer
 *                           viable, has no status of its own here)
 *
 * The scheme used to be Spec 5's blue, teal, green, yellow, red, in which
 * green meant "due this month", close to the opposite of the GOM's green:
 * a pilot trained on the GOM could misread it. Kept as a single map so the
 * grid cells, chips and the pilot-row overall status all render the same.
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
    pill: "status-mark text-[0.6rem] text-status-green",
    badge: "status-mark text-status-green",
    rowTint: "",
  },
  early_month: {
    label: "Early",
    pill: "status-mark text-[0.6rem] text-status-green",
    badge: "status-mark text-status-green",
    rowTint: "",
  },
  due_this_month: {
    label: "Due This Month",
    pill: "status-mark text-[0.6rem] text-status-gold",
    badge: "status-mark text-status-gold",
    rowTint: "",
  },
  grace_month: {
    label: "Grace",
    pill: "status-mark text-[0.6rem] text-status-red",
    badge: "status-mark text-status-red",
    rowTint: "bg-status-red/[0.03]",
  },
  non_current: {
    label: "Non-Current",
    pill: "status-mark text-[0.6rem] text-status-magenta",
    badge: "status-mark text-status-magenta",
    rowTint: "bg-status-magenta/[0.04]",
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

/** A check failed since the last pass (#98), as the board, the list and
 *  the pilot page say it: "2026-10-28 · Sam Examiner". Null when the cell
 *  has no failure, or reads anything but non-current. It stays
 *  non-current until a pass is logged. */
export function failedText(cell: PilotCurrencyCell): string | null {
  if (!cell.failed_on || cell.status !== "non_current") return null;
  return cell.failed_by ? `${cell.failed_on} · ${cell.failed_by}` : cell.failed_on;
}

/**
 * Tab keys + default-range helpers for the My History page. Lives
 * in its own module so the page + tests can share it without
 * coupling to the page's render code.
 */

export const HISTORY_TAB_KEYS = ["flight", "duty"] as const;
export type HistoryTab = (typeof HISTORY_TAB_KEYS)[number];

export const HISTORY_TAB_LABELS: Record<HistoryTab, string> = {
  flight: "Flight",
  duty: "Duty",
};

export function isHistoryTab(value: string | undefined): value is HistoryTab {
  return value === "flight" || value === "duty";
}

/** Default date range when the URL doesn't carry from/to params.
 *  Last 30 days, ending today (UTC) — matches the legacy default
 *  and is short enough that a busy pilot's last month is visible
 *  without scrolling. */
export function defaultRange(): { from: string; to: string } {
  const now = new Date();
  const to = isoDate(now);
  const fromDate = new Date(now);
  fromDate.setUTCDate(fromDate.getUTCDate() - 30);
  const from = isoDate(fromDate);
  return { from, to };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

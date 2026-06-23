/**
 * 7-tab keys + labels for the elog detail page. Numbered to match
 * legacy `templates/elog/log_page.html`. Tab 4 keeps its legacy key
 * ("times") even though the label is "Flight Summary" — renaming the
 * URL parameter would break shared bookmarks once those exist.
 */

export const TAB_KEYS = [
  "info",
  "legs",
  "wb",
  "times",
  "trends",
  "vor",
  "misc",
] as const;

export type TabKey = (typeof TAB_KEYS)[number];

export const TAB_LABELS: Record<TabKey, string> = {
  info: "Flight Info",
  legs: "Legs",
  wb: "W&B",
  times: "Flight Summary",
  trends: "Trends",
  vor: "VOR",
  misc: "Misc",
};

export function isTabKey(value: string | undefined): value is TabKey {
  return value !== undefined && (TAB_KEYS as readonly string[]).includes(value);
}

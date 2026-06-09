/**
 * URL-driven view state for the Flight Following page.
 *
 * Both axes are surfaced as searchParams (`?view=today&display=list`)
 * so each tab/toggle combination is deep-linkable, shareable, and
 * survives a server refresh — no client-side localStorage needed.
 *
 * Defaults match the legacy `dispatch-platform-main/templates/
 * flight_following/board.html`: list view, today filter. Anything else
 * is opt-in.
 */

export const VIEW_VALUES = ["today", "tomorrow", "week", "all"] as const;
export type FlightFollowingView = (typeof VIEW_VALUES)[number];
export const DEFAULT_VIEW: FlightFollowingView = "today";

export const DISPLAY_VALUES = ["list", "split", "map"] as const;
export type FlightFollowingDisplay = (typeof DISPLAY_VALUES)[number];
export const DEFAULT_DISPLAY: FlightFollowingDisplay = "list";

export function parseView(raw: string | undefined): FlightFollowingView {
  return (VIEW_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as FlightFollowingView)
    : DEFAULT_VIEW;
}

export function parseDisplay(raw: string | undefined): FlightFollowingDisplay {
  return (DISPLAY_VALUES as readonly string[]).includes(raw ?? "")
    ? (raw as FlightFollowingDisplay)
    : DEFAULT_DISPLAY;
}

export const VIEW_LABELS: Record<FlightFollowingView, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  week: "7 Day",
  all: "All Planned",
};

export const DISPLAY_LABELS: Record<FlightFollowingDisplay, string> = {
  list: "List",
  split: "Split",
  map: "Map",
};

/** Copy under the board explaining what each filter actually returns —
 *  verbatim from the legacy board.html. */
export const VIEW_HINTS: Record<FlightFollowingView, string> = {
  today: "Showing: airborne + departing within 24h + completed last 12h",
  tomorrow: "Showing: flights departing 24-48 hours from now",
  week: "Showing: all flights in the next 7 days",
  all: "Showing: all planned flights (max 100)",
};

/** Build the canonical href for a given (view, display) pair. Omits
 *  defaults so the URL stays clean on the landing page. */
export function flightFollowingHref(
  view: FlightFollowingView,
  display: FlightFollowingDisplay,
): string {
  const params = new URLSearchParams();
  if (view !== DEFAULT_VIEW) params.set("view", view);
  if (display !== DEFAULT_DISPLAY) params.set("display", display);
  const qs = params.toString();
  return qs ? `/flight-following?${qs}` : "/flight-following";
}

import { DisplayToggle } from "@/components/flight-following/display-toggle";
import { FilterTabs } from "@/components/flight-following/filter-tabs";
import { FleetMapLoader } from "@/components/flight-following/fleet-map-loader";
import { ListViewPlaceholder } from "@/components/flight-following/list-view-placeholder";
import { PageHeader } from "@/components/flight-following/page-header";
import { SourceLegend } from "@/components/flight-following/source-legend";
import { SplitViewPlaceholder } from "@/components/flight-following/split-view-placeholder";
import {
  VIEW_HINTS,
  parseDisplay,
  parseView,
} from "@/components/flight-following/view-types";
import { ApiError } from "@/lib/api/client";
import { getLatestPositions } from "@/lib/api/flight-following";
import type { PositionResponse } from "@/lib/api/types";

/**
 * /flight-following — live ops board (M2-G-10 chrome).
 *
 * URL-driven view state:
 *   ?view=today|tomorrow|week|all   (default: today)
 *   ?display=list|split|map         (default: list)
 *
 * Both parameters are independent — switching the day filter
 * preserves the user's display mode and vice versa. Each combination
 * is deep-linkable, which matches how dispatchers actually share
 * board state ("look at /flight-following?view=tomorrow").
 *
 * Story scope:
 *   M2-G-10 (this) — header, filter tabs, display toggle, route to
 *                    one of three view bodies. List + Split bodies
 *                    are placeholders.
 *   M2-G-11        — real flight board table for the List view,
 *                    powered by a new ops endpoint that returns
 *                    flights filtered by the day-window tab.
 *   M2-G-12        — wire the real list into Split view's right pane.
 */
export default async function FlightFollowingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; display?: string }>;
}) {
  const { view: viewParam, display: displayParam } = await searchParams;
  const view = parseView(viewParam);
  const display = parseDisplay(displayParam);

  // Positions are only needed when the map is on screen. Skip the
  // fetch entirely for the pure list view — keeps the page snappy and
  // doesn't pin the user to the flight-following-service being up
  // when they just want the flight table.
  const needsPositions = display === "map" || display === "split";
  let positions: PositionResponse[] = [];
  let loadError: string | null = null;

  if (needsPositions) {
    try {
      const response = await getLatestPositions();
      positions = response.items;
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      loadError =
        status === 401
          ? "Your session expired — please sign in again."
          : "Flight-following feed unavailable. Try refreshing in a moment.";
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100vh-9rem)] max-w-7xl flex-col px-4 py-6 sm:px-6">
      <PageHeader />

      <div className="mb-4 flex items-center justify-between gap-4">
        <FilterTabs activeView={view} display={display} />
        <DisplayToggle view={view} activeDisplay={display} />
      </div>

      <div className="min-h-0 flex-1">
        {display === "list" && <ListViewPlaceholder />}
        {display === "split" && (
          <MapOrFallback
            positions={positions}
            loadError={loadError}
            render={(p) => <SplitViewPlaceholder positions={p} />}
            heightClass="h-[calc(100vh-22rem)]"
          />
        )}
        {display === "map" && (
          <MapOrFallback
            positions={positions}
            loadError={loadError}
            render={(p) => (
              <div className="h-full overflow-hidden rounded-lg border border-border bg-card">
                <FleetMapLoader positions={p} />
              </div>
            )}
            heightClass="h-[calc(100vh-22rem)]"
          />
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground/70">{VIEW_HINTS[view]}</p>
      {(display === "map" || display === "split") && <SourceLegend />}
    </div>
  );
}

/**
 * Renders either the map (or split view) or one of the fallback
 * states — empty fleet, auth error, generic error. Centralised so all
 * display modes that need positions share the same UX.
 */
function MapOrFallback({
  positions,
  loadError,
  render,
  heightClass,
}: {
  positions: PositionResponse[];
  loadError: string | null;
  render: (positions: PositionResponse[]) => React.ReactNode;
  heightClass: string;
}) {
  if (loadError) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground ${heightClass}`}
      >
        {loadError}
      </div>
    );
  }
  if (positions.length === 0) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground ${heightClass}`}
      >
        No position data yet. The flight-following-service hasn&apos;t
        received any fixes for aircraft in your tenant.
        <br />
        (Demo seeder: <code>docker compose up seed-positions</code>)
      </div>
    );
  }
  return <div className={heightClass}>{render(positions)}</div>;
}

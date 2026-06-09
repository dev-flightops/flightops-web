import { DisplayToggle } from "@/components/flight-following/display-toggle";
import { FilterTabs } from "@/components/flight-following/filter-tabs";
import { FleetMapLoader } from "@/components/flight-following/fleet-map-loader";
import { FlightBoard } from "@/components/flight-following/flight-board";
import { PageHeader } from "@/components/flight-following/page-header";
import { SourceLegend } from "@/components/flight-following/source-legend";
import { SplitView } from "@/components/flight-following/split-view";
import {
  VIEW_HINTS,
  parseDisplay,
  parseView,
  type FlightFollowingView,
} from "@/components/flight-following/view-types";
import { ApiError } from "@/lib/api/client";
import {
  getFlightBoard,
  getLatestPositions,
} from "@/lib/api/flight-following";
import type {
  BoardFlightItem,
  BoardView,
  PositionResponse,
} from "@/lib/api/types";

/**
 * /flight-following — live ops board.
 *
 * URL-driven view state:
 *   ?view=today|tomorrow|week|all   (default: today)
 *   ?display=list|split|map         (default: list)
 *
 * Each display mode fetches only what it needs:
 *   list  → /ops/following/board?view=...  (M2-M-14 endpoint)
 *   map   → /flight-following/positions/latest
 *   split → both (map for left pane; board reserved for M2-G-12)
 *
 * Story scope progression:
 *   M2-G-10 — header, filter tabs, display toggle, three placeholder bodies.
 *   M2-G-11 — list-view body now renders the real flight board table.
 *   M2-G-12 — wire the board into the split view's right pane.
 */
export default async function FlightFollowingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; display?: string }>;
}) {
  const { view: viewParam, display: displayParam } = await searchParams;
  const view = parseView(viewParam);
  const display = parseDisplay(displayParam);

  const needsPositions = display === "map" || display === "split";
  const needsBoard = display === "list" || display === "split";

  let positions: PositionResponse[] = [];
  let positionsError: string | null = null;
  let board: BoardFlightItem[] = [];
  let boardError: string | null = null;

  if (needsPositions) {
    try {
      positions = (await getLatestPositions()).items;
    } catch (err) {
      positionsError = errorMessage(err, "flight-following");
    }
  }

  if (needsBoard) {
    try {
      board = (await getFlightBoard(view as BoardView)).items;
    } catch (err) {
      boardError = errorMessage(err, "board");
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
        {display === "list" && (
          <BoardOrError flights={board} loadError={boardError} />
        )}
        {display === "split" && (
          <SplitOrError
            flights={board}
            positions={positions}
            boardError={boardError}
            positionsError={positionsError}
            heightClass="h-[calc(100vh-22rem)]"
          />
        )}
        {display === "map" && (
          <MapOrFallback
            positions={positions}
            loadError={positionsError}
            render={(p) => (
              <div className="h-full overflow-hidden rounded-lg border border-border bg-card">
                <FleetMapLoader positions={p} />
              </div>
            )}
            heightClass="h-[calc(100vh-22rem)]"
          />
        )}
      </div>

      <p className="mt-3 text-xs text-muted-foreground/70">
        {VIEW_HINTS[view as FlightFollowingView]}
      </p>
      {(display === "map" || display === "split") && <SourceLegend />}
    </div>
  );
}

function errorMessage(err: unknown, surface: "flight-following" | "board"): string {
  const status = err instanceof ApiError ? err.status : 0;
  if (status === 401) {
    return "Your session expired — please sign in again.";
  }
  return surface === "board"
    ? "Flight board unavailable. Try refreshing in a moment."
    : "Flight-following feed unavailable. Try refreshing in a moment.";
}

function BoardOrError({
  flights,
  loadError,
}: {
  flights: BoardFlightItem[];
  loadError: string | null;
}) {
  if (loadError) {
    return (
      <div className="flex h-[calc(100vh-22rem)] w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground">
        {loadError}
      </div>
    );
  }
  return <FlightBoard flights={flights} />;
}

/**
 * Split view needs BOTH feeds. Prefer the more specific error message
 * when only one failed; if both failed, surface the board one
 * (typically the auth error — same root cause for both endpoints).
 */
function SplitOrError({
  flights,
  positions,
  boardError,
  positionsError,
  heightClass,
}: {
  flights: BoardFlightItem[];
  positions: PositionResponse[];
  boardError: string | null;
  positionsError: string | null;
  heightClass: string;
}) {
  const loadError = boardError ?? positionsError;
  if (loadError) {
    return (
      <div
        className={`flex w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-center text-sm text-muted-foreground ${heightClass}`}
      >
        {loadError}
      </div>
    );
  }
  return (
    <div className={heightClass}>
      <SplitView flights={flights} positions={positions} />
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

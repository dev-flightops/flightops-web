import { EmptyState } from "@/components/ff/empty-state";
import { PageHeader } from "@/components/ff/page-header";
import { Panel } from "@/components/ff/panel";
import { ApiError } from "@/lib/api/client";
import { listAircraft, listFlightLogs, listFlights } from "@/lib/api/ops";
import type {
  AircraftListItem,
  FlightListItem,
  FlightLogResponse,
} from "@/lib/api/types";

import { ActiveDraftsPanel } from "./active-drafts-panel";
import { NewFlightLogForm } from "./new-flight-log-form";

/**
 * /flight-crew/elog — Electronic Flight Log landing (Spec 4 step 4).
 *
 * Moved out of /flight-log/ in this PR so the pilot's three core
 * surfaces (preflight, elog, history) all live under one parent
 * route — /flight-log/ keeps a permanent redirect for bookmarks.
 *
 * Mirrors legacy `peregrineflight.com/elog/`:
 *   - Title "Electronic Flight Log" + today's local date subtitle
 *   - Active Logs (Draft) panel — list of in-progress
 *     logs (empty list collapses the panel, same as legacy)
 *   - New Flight Log form — Aircraft / Flight / Flight Number /
 *     Flight Type, submit creates a draft + redirects to the 7-tab
 *     page scaffold at /flight-crew/elog/{id}
 *
 * Three parallel fetches: drafts (logs panel), active aircraft (form
 * dropdown), released-but-not-completed flights (form dropdown).
 */

const PAGE_LIMIT = 50;

function todayLong(): string {
  return new Date().toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export default async function FlightLogPage() {
  let drafts: FlightLogResponse[] = [];
  let aircraft: AircraftListItem[] = [];
  let recentFlights: FlightListItem[] = [];
  let loadError: string | null = null;

  try {
    const [draftsResult, aircraftResult, flightsResult] = await Promise.all([
      // The caller's own drafts, as legacy's active-logs list: a draft is
      // its filing pilot's to finish (the backend refuses anyone else's
      // edits since 29 Sep, bar a Chief Pilot, DO or Exec Admin).
      listFlightLogs({ status: "draft", mine: true, limit: PAGE_LIMIT }),
      listAircraft(),
      // "Flight" dropdown shows currently-released flights (the pilot
      // is almost certainly logging one of these). Completed flights
      // are still loggable but the dispatcher uses the Update flow
      // for those — kept out of the picker to keep it short.
      listFlights({ status: "released", limit: PAGE_LIMIT }),
    ]);
    drafts = draftsResult.items;
    aircraft = aircraftResult.items.filter((a) => a.is_active);
    recentFlights = flightsResult.items;
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Flight log unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <PageHeader title="Electronic Flight Log" description={todayLong()} />

      {loadError ? (
        <div role="alert" className="notice notice-yellow">
          {loadError}
        </div>
      ) : (
        <div className="space-y-6">
          <ActiveDraftsPanel drafts={drafts} />
          {aircraft.length === 0 ? (
            <Panel title="New Flight Log" flush>
              <EmptyState>
                No active aircraft on this tenant.
                <span className="block pt-1 text-xs">
                  Activate one on the Maintenance page before starting a
                  flight log.
                </span>
              </EmptyState>
            </Panel>
          ) : (
            <NewFlightLogForm
              aircraft={aircraft}
              recentFlights={recentFlights}
            />
          )}
        </div>
      )}
    </div>
  );
}

import type { BoardFlightItem, PositionResponse } from "@/lib/api/types";
import { mergeTrackedAircraft } from "@/lib/flight-following/merge-tracked";

import { FleetMapLoader } from "./fleet-map-loader";
import { TrackedAircraftTable } from "./tracked-aircraft-table";

/**
 * Split view = live map on the left, condensed "Tracked aircraft"
 * table on the right. The two panels are independent fetches joined
 * client-side in `mergeTrackedAircraft` by aircraft.id.
 *
 * Layout matches the legacy `#split-list`: ~320px right column with
 * sticky table header so dispatchers can scan a long fleet without
 * losing the column labels.
 */
export function SplitView({
  flights,
  positions,
}: {
  flights: BoardFlightItem[];
  positions: PositionResponse[];
}) {
  const tracked = mergeTrackedAircraft(flights, positions);

  return (
    <div className="grid h-full gap-3 lg:grid-cols-[1fr_320px]">
      <div className="min-h-[400px] overflow-hidden rounded-lg border border-border bg-card">
        <FleetMapLoader positions={positions} />
      </div>
      <aside className="flex flex-col overflow-hidden rounded-lg border border-border bg-card">
        <h2 className="border-b border-border px-3 py-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Tracked aircraft
        </h2>
        <TrackedAircraftTable rows={tracked} />
      </aside>
    </div>
  );
}

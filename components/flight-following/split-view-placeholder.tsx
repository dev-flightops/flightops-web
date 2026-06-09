import type { PositionResponse } from "@/lib/api/types";

import { FleetMapLoader } from "./fleet-map-loader";

/**
 * Split view = map on the left, tracked-aircraft side table on the
 * right. The side table is a condensed view of the same flights the
 * list shows (M2-G-11 builds the data model; M2-G-12 wires it here).
 *
 * Until then the right column is a placeholder that explains what's
 * coming. The map stays fully functional on the left so the split
 * mode is still useful in M2 — dispatchers can see live positions
 * with one click less than swapping back to Map.
 */
export function SplitViewPlaceholder({
  positions,
}: {
  positions: PositionResponse[];
}) {
  return (
    <div className="grid h-full gap-3 lg:grid-cols-[1fr_320px]">
      <div className="min-h-[400px] overflow-hidden rounded-lg border border-border bg-card">
        <FleetMapLoader positions={positions} />
      </div>
      <aside className="flex flex-col rounded-lg border border-border bg-card/40 p-3">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Tracked aircraft
        </h2>
        <div className="flex flex-1 items-center justify-center px-2 text-center text-[0.7rem] text-muted-foreground/70">
          Side table lands in M2-G-12 with the same data as the list
          view, condensed.
        </div>
      </aside>
    </div>
  );
}

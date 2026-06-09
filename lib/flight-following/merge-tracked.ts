import type { BoardFlightItem, PositionResponse } from "@/lib/api/types";

/**
 * One row on the Split view's right-side "Tracked aircraft" table.
 *
 * Joins a board flight with the latest position fix for its aircraft
 * (matched by aircraft.id). `position` is null when the
 * flight-following-service hasn't logged a fix for this aircraft yet —
 * typical for scheduled flights before the first ADS-B/GPS uplink.
 */
export interface TrackedAircraft {
  flight: BoardFlightItem;
  position: PositionResponse | null;
}

/**
 * Merge the board flights with the latest position per aircraft.
 *
 * Why merge here rather than ask the backend for a combined shape?
 * The two queries are independent and reusable as-is in other views —
 * the Map view only needs positions, the List view only needs the
 * board. Forcing a combined endpoint here would either duplicate code
 * or thread split-specific concerns into routes that don't care.
 *
 * Multiple flights can share an aircraft within a day (back-to-back
 * legs). Each flight row gets the same latest-position pointer; the
 * caller decides whether to show altitude/speed (only meaningful for
 * the currently-airborne flight, gated by `flight.status === "released"`
 * downstream).
 */
export function mergeTrackedAircraft(
  board: BoardFlightItem[],
  positions: PositionResponse[],
): TrackedAircraft[] {
  const byAircraftId = new Map<string, PositionResponse>();
  for (const p of positions) {
    byAircraftId.set(p.aircraft.id, p);
  }
  return board.map((flight) => ({
    flight,
    position: byAircraftId.get(flight.aircraft.id) ?? null,
  }));
}

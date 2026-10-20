import { Stat, StatStrip } from "@/components/ff/stat-strip";
import type { BoardFlightItem } from "@/lib/api/types";

/**
 * 4-chip stats bar above the flight board / map per the Flight
 * Following spec, top of page:
 *
 *   X Airborne (green) · Y Released (blue) · Z Planned (grey) · W Delayed (yellow)
 *
 * Counts are derived from the same board response that drives the
 * table — one source, no extra fetch. "Airborne" = released flights
 * that have an actual_departure_at recorded; "Released" = released
 * without ATD yet; "Planned" = scheduled status; "Delayed" = released
 * AND scheduled departure passed AND no actual_departure_at yet. The
 * dedicated DELAYED status the spec lists isn't on the backend yet
 * (would need a status state machine extension), so we infer it.
 */
export function SummaryStatsBar({
  flights,
}: {
  flights: BoardFlightItem[];
}) {
  const now = Date.now();
  let airborne = 0;
  let released = 0;
  let planned = 0;
  let delayed = 0;

  for (const f of flights) {
    if (f.status === "scheduled") {
      planned += 1;
    } else if (f.status === "released") {
      if (f.actual_departure_at) {
        airborne += 1;
      } else {
        released += 1;
        const sched = new Date(f.scheduled_departure_at).getTime();
        if (sched < now) delayed += 1;
      }
    }
  }

  // A stat strip in ForeFlight's manner (#78): the count large in the
  // display face, an UPPERCASE label under it, a thin status rule to the
  // left — no tinted chips.
  return (
    <StatStrip label="Flight summary" className="mb-5">
      <Stat value={airborne} label="Airborne" tone="green" />
      <Stat value={released} label="Released" tone="blue" />
      <Stat value={planned} label="Planned" />
      <Stat value={delayed} label="Delayed" tone="yellow" />
    </StatStrip>
  );
}

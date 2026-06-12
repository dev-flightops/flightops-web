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

  return (
    <div
      role="group"
      aria-label="Flight summary"
      className="mb-3 flex flex-wrap gap-2"
    >
      <Chip value={airborne} label="Airborne" tone="green" />
      <Chip value={released} label="Released" tone="blue" />
      <Chip value={planned} label="Planned" tone="grey" />
      <Chip value={delayed} label="Delayed" tone="yellow" />
    </div>
  );
}

function Chip({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "green" | "blue" | "grey" | "yellow";
}) {
  const colorClass =
    tone === "green"
      ? "border-status-green/40 bg-status-green/[0.08] text-status-green"
      : tone === "blue"
        ? "border-status-blue/40 bg-status-blue/[0.08] text-status-blue"
        : tone === "yellow"
          ? "border-status-yellow/40 bg-status-yellow/[0.08] text-status-yellow"
          : "border-border bg-card text-muted-foreground";
  return (
    <span
      className={`inline-flex items-baseline gap-1.5 rounded-md border px-3 py-1.5 text-xs ${colorClass}`}
    >
      <span className="font-bold">{value}</span>
      <span className="uppercase tracking-[0.06em]">{label}</span>
    </span>
  );
}

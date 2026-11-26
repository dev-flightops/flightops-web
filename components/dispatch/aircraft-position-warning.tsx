import type { AircraftPositionConflict } from "@/lib/api/types";
import { DEFAULT_TIME_ZONE, localClock, localDate } from "@/lib/format/local-time";

/**
 * Where the aircraft will be, against where this flight takes it (1124-05):
 * the client's N503PA landed at Kipnuk at 10:35 while its next flight left
 * Anchorage at 11:00, and nothing said so. A warning, not a refusal: a
 * flight that diverted isn't on file where it landed.
 */
export function AircraftPositionWarning({
  tail,
  origin,
  destination,
  conflicts,
}: {
  tail: string;
  origin: string;
  destination: string;
  conflicts: AircraftPositionConflict[];
}) {
  if (conflicts.length === 0) return null;
  return (
    <div role="alert" aria-label="Aircraft position" className="notice notice-yellow">
      <p className="notice-label">Aircraft position</p>
      {conflicts.map((c) => (
        <p key={`${c.kind}-${c.flight_id}`} className="text-sm">
          {c.kind === "arrives_elsewhere"
            ? `${tail} lands at ${c.airport} ${when(c.at)} on ${c.flight_number}, not at ${origin}, where this flight leaves from.`
            : `${tail}'s next flight, ${c.flight_number}, leaves ${c.airport} ${when(c.at)}, not ${destination}, where this one lands.`}
        </p>
      ))}
      <p className="mt-1 text-xs text-muted-foreground">
        Add a flight to move it there, or check the aircraft on these flights.
      </p>
    </div>
  );
}

/** "on Nov 25 at 10:35 AKST". */
function when(iso: string): string {
  return `on ${localDate(iso, DEFAULT_TIME_ZONE)} at ${localClock(iso, DEFAULT_TIME_ZONE)}`;
}

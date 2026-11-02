import type { DayPreflight } from "@/lib/api/ops";

import { ReassignAircraft } from "./reassign-aircraft";
import { DEFAULT_TIME_ZONE, localClock } from "@/lib/format/local-time";

/**
 * Aircraft today (#93): which aircraft the pilots took this morning, by
 * whom, and whether its preflight and run-up are on record. A flight in an
 * aircraft with none can't be accepted, so dispatch sees the gap before the
 * pilot does.
 */
export function AircraftTodayPanel({
  today,
  pilots = [],
}: {
  today: { items: DayPreflight[] } | null;
  /** The pilots dispatch can give an aircraft to; empty for anyone who can't (AIRCRAFT_ASSIGNERS). */
  pilots?: { id: string; name: string }[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5" aria-label="Aircraft today">
      <h2 className="panel-title">Aircraft today</h2>
      {today === null ? (
        <p className="mt-2 text-xs text-muted-foreground">Couldn&apos;t load today&apos;s aircraft.</p>
      ) : today.items.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">
          No aircraft taken yet today. Pilots take theirs on Flight Crew after duty in.
        </p>
      ) : (
        <table className="data-table mt-3 w-full text-sm">
          <thead>
            <tr>
              <th>Aircraft</th>
              <th>Pilot</th>
              <th>Taken</th>
              <th>Preflight and run-up</th>
              {pilots.length ? <th>Move</th> : null}
            </tr>
          </thead>
          <tbody>
            {today.items.map((row) => (
              <tr key={row.id}>
                <td className="font-mono font-semibold">{row.tail_number}</td>
                <td>
                  {row.pilot_name}
                  {row.assigned_by_name ? (
                    <span className="block text-xs text-muted-foreground">{`given by ${row.assigned_by_name}`}</span>
                  ) : null}
                </td>
                <td>{at(row.picked_at)}</td>
                <td>{row.preflight_at ? preflight(row) : <span className="text-status-yellow">Not yet</span>}</td>
                {pilots.length ? (
                  <td>
                    <ReassignAircraft
                      preflightId={row.id}
                      tail={row.tail_number}
                      currentPilotId={row.pilot_user_id}
                      pilots={pilots}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/**
 * The selected flight's aircraft today (#93), on the dispatch packet: whose
 * it is and whether its preflight and run-up are on record. A flight in an
 * aircraft without one can't be accepted, and the packet is where dispatch
 * is when the pilot calls about it.
 */
export function AircraftTodayLine({
  tail,
  aircraftId,
  today,
}: {
  tail: string;
  aircraftId: string;
  today: { items: DayPreflight[] };
}) {
  const row = today.items.find((r) => r.aircraft_id === aircraftId);
  let text: string;
  if (!row) {
    text = " hasn't been taken today. Its pilot takes it on Flight Crew and records the preflight and run-up before accepting.";
  } else if (row.preflight_at) {
    text = ` is ${row.pilot_name}'s today; preflight and run-up at ${preflight(row)}.`;
  } else {
    text = ` is ${row.pilot_name}'s today. Its preflight and run-up aren't on record yet, so the flight can't be accepted.`;
  }
  return (
    <p className="text-sm text-foreground" aria-label="Aircraft today">
      <span className="font-mono font-semibold">{tail}</span>
      {text}
    </p>
  );
}

function at(iso: string): string {
  return localClock(iso, DEFAULT_TIME_ZONE);
}

function preflight(row: DayPreflight): string {
  const amounts = [
    row.fuel_gallons != null ? `${Number(row.fuel_gallons)} gal` : null,
    row.oil_quarts != null ? `${Number(row.oil_quarts)} qt` : null,
  ].filter(Boolean);
  return `${at(row.preflight_at!)}${amounts.length ? ` · ${amounts.join(", ")}` : ""}`;
}

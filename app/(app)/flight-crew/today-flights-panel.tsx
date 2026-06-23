import Link from "next/link";

import type { FlightListItem } from "@/lib/api/types";

interface Props {
  flights: FlightListItem[];
}

/**
 * "My Flights today" panel (Spec 4 §"Page layout / My Flights today").
 *
 * One card per flight: flight number, route, aircraft, scheduled
 * departure (UTC short), status badge, Begin Preflight CTA.
 *
 * Status badges in M2 reuse the existing flight status enum
 * (`scheduled` / `released` / etc.); Spec 4's preflight-job-flow status
 * model lands when the 8-step flow ships.
 */
export function TodayFlightsPanel({ flights }: Props) {
  if (flights.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center text-sm text-muted-foreground">
        Nothing on your schedule today.{" "}
        <Link
          href="/flight-crew/elog"
          className="font-semibold text-status-blue hover:underline"
        >
          Create a manual log
        </Link>{" "}
        for off-schedule flying.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {flights.map((f) => (
        <FlightCard key={f.id} flight={f} />
      ))}
    </ul>
  );
}

function FlightCard({ flight }: { flight: FlightListItem }) {
  return (
    <li className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-foreground">
              {flight.flight_number}
            </span>
            <StatusBadge status={flight.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {flight.origin} → {flight.destination}
            </span>
            <span className="text-xs">
              {flight.aircraft.tail_number}
              {flight.aircraft.model ? (
                <span className="text-muted-foreground/70">
                  {" · "}
                  {flight.aircraft.model}
                </span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 text-[0.7rem] text-muted-foreground">
            ETD {formatUtcTime(flight.scheduled_departure_at)}
            {" · ETA "}
            {formatUtcTime(flight.scheduled_arrival_at)}
          </div>
        </div>
        <Link
          href={`/flight-crew/preflight/${flight.id}`}
          className="shrink-0 rounded-md border border-status-blue/40 bg-status-blue/10 px-3 py-1.5 text-xs font-semibold text-status-blue transition-colors hover:bg-status-blue/15"
        >
          Begin Preflight →
        </Link>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "released"
      ? "blue"
      : status === "scheduled"
        ? "yellow"
        : status === "cancelled"
          ? "red"
          : "muted";
  const cls =
    tone === "blue"
      ? "border-status-blue/40 bg-status-blue/10 text-status-blue"
      : tone === "yellow"
        ? "border-status-yellow/40 bg-status-yellow/10 text-status-yellow"
        : tone === "red"
          ? "border-status-red/40 bg-status-red/10 text-status-red"
          : "border-border bg-muted/10 text-muted-foreground";
  const label =
    status === "released"
      ? "Released"
      : status === "scheduled"
        ? "Scheduled"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return (
    <span
      className={`rounded-sm border px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.06em] ${cls}`}
    >
      {label}
    </span>
  );
}

function formatUtcTime(iso: string): string {
  // 14:25Z shape — matches the dispatch + flight-following convention.
  return `${iso.slice(11, 16)}Z`;
}

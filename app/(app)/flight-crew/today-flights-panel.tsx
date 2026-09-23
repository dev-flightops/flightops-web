import Link from "next/link";

import type { FlightListItem } from "@/lib/api/types";

interface Props {
  flights: FlightListItem[];
}

/**
 * "My Flights" panel (Spec 4 §"Page layout / My Flights today").
 *
 * One card per flight: flight number, route, aircraft, the date and
 * scheduled times in UTC, status badge, Begin Preflight CTA.
 *
 * WHY EVERY CARD CARRIES A DATE, AND WHY NOTHING SAYS "TODAY"
 *
 * The page used to ask the server for one UTC day and call it today.
 * The server cannot know the viewer's time zone, so that day is wrong
 * for anybody off UTC — at 16:00 in Alaska it is already tomorrow in
 * UTC, which hid a pilot's own evening flight behind "You're not
 * rostered on any flights today" with no other route to a preflight on
 * the page. Same fault as the fleet-board calendar arrows on 8/24: a
 * point in time used as a calendar date across a zone boundary.
 *
 * The page now fetches a three-UTC-day window, and this panel does no
 * calendar arithmetic at all — it lists what it was given, in time
 * order, with each card's date on it. Re-deriving a local "today" here
 * would put the same class of bug back, one layer down, and would make
 * this component's server and client renders disagree.
 *
 * So a pilot reads dates instead of being told which day is theirs.
 * Spec 4's heading said "today"; showing them their next flights and
 * letting them see when is the same intent without the guess.
 *
 * Status badges in M2 reuse the existing flight status enum
 * (`scheduled` / `released` / etc.); Spec 4's preflight-job-flow status
 * model lands when the 8-step flow ships.
 */
export function TodayFlightsPanel({ flights }: Props) {
  if (flights.length === 0) {
    // This used to mean "no flights in the tenant today", because the
    // panel showed all of them. It now means "dispatch has not rostered
    // you onto anything", which is a different thing and worth saying
    // out loud: a pilot who expects to be flying should ring dispatch
    // rather than assume the page is broken.
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-8 text-center text-sm text-muted-foreground">
        You&apos;re not rostered on any flights just now.{" "}
        <span className="block pt-1 text-xs">
          If you&apos;re expecting to fly, check with dispatch — or{" "}
          <Link
            href="/flight-crew/elog"
            className="font-semibold text-status-blue hover:underline"
          >
            create a manual log
          </Link>{" "}
          for off-schedule flying.
        </span>
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
            {/* The date is not decoration. Without it a pilot looking
                at two cards cannot tell which one is tonight. */}
            <span className="font-semibold text-foreground/80">
              {formatUtcDate(flight.scheduled_departure_at)}
            </span>
            {" · ETD "}
            {formatUtcTime(flight.scheduled_departure_at)}
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

function formatUtcDate(iso: string): string {
  // Sliced out of the ISO string rather than parsed through Date.
  // new Date(iso).toLocaleDateString() would re-introduce exactly the
  // bug this panel exists to avoid: it renders in the server's zone on
  // the server and the browser's on the client, so the two disagree and
  // the date shifts under the reader on hydration. The times beside it
  // are already UTC and marked Z; the date matches them.
  return `${iso.slice(5, 7)}-${iso.slice(8, 10)}`;
}

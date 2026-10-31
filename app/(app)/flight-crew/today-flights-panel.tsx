import Link from "next/link";

import { buttonOutline, linkCaps } from "@/components/ff/controls";
import { EmptyState } from "@/components/ff/empty-state";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import type { FlightListItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import { routeText } from "@/lib/route";

interface Props {
  flights: FlightListItem[];
}

/**
 * "My Flights" panel (Spec 4 §"Page layout / My Flights today").
 *
 * One row per flight (#81: rows in the page's My Flights panel, not
 * cards): flight number, route, aircraft, the date and scheduled times
 * in UTC, status mark, Begin Preflight.
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
      <EmptyState>
        You&apos;re not rostered on any flights just now.{" "}
        <span className="block pt-1 text-xs">
          If you&apos;re expecting to fly, check with dispatch — or{" "}
          <Link
            href="/flight-crew/elog"
            className="font-semibold text-primary hover:underline"
          >
            create a manual log
          </Link>{" "}
          for off-schedule flying.
        </span>
      </EmptyState>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {flights.map((f) => (
        <FlightCard key={f.id} flight={f} />
      ))}
    </ul>
  );
}

function FlightCard({ flight }: { flight: FlightListItem }) {
  return (
    <li className="px-5 py-4 transition-colors hover:bg-accent/40">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-base font-bold text-foreground">
              {flight.flight_number}
            </span>
            <StatusBadge status={flight.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="font-mono font-semibold text-foreground">
              {routeText(flight)}
            </span>
            <span className="text-xs">
              {flight.aircraft.tail_number}
              {flight.aircraft.model ? (
                <span className="text-muted-foreground">
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
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Link
            href={`/flight-crew/preflight/${flight.id}`}
            className={cn(buttonOutline, "px-3 py-1.5")}
          >
            Begin Preflight →
          </Link>
          {/* The flight's FRAT, filed and signed before the release (#155):
              "opened right from that flight on ... the pilot's schedule". */}
          <Link href={`/frat/${flight.id}`} className={linkCaps}>
            FRAT ›
          </Link>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ status }: { status: string }) {
  const tone: StatusTone =
    status === "released"
      ? "blue"
      : status === "scheduled"
        ? "yellow"
        : status === "cancelled"
          ? "red"
          : "muted";
  const label =
    status === "released"
      ? "Released"
      : status === "scheduled"
        ? "Scheduled"
        : status.charAt(0).toUpperCase() + status.slice(1);
  return <StatusMark label={label} tone={tone} />;
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

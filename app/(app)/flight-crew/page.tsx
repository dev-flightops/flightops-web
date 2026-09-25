import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getCurrentDuty, listFlights } from "@/lib/api/ops";
import type { CurrentDutyResponse, FlightListItem } from "@/lib/api/types";
import { currentGreeting, firstNameFrom } from "@/lib/greeting";

import { DutyClockButton } from "./duty-clock-button";
import { TodayFlightsPanel } from "./today-flights-panel";
import { TrainingCurrencySummary } from "./training-currency-summary";

const DUTY_OFFLINE_DEFAULT: CurrentDutyResponse = {
  open: null,
  last_closed: null,
  min_rest_hours: 9,
  max_duty_hours: 14,
  warnings: [],
};

/**
 * /flight-crew/ — Pilot home page (Spec 4 §"PILOT HOME PAGE").
 *
 * What a pilot lands on after sign-in. Spec layout:
 *
 *   1. Duty In / Out hero button at the top — blue DUTY IN icon when
 *      off-shift, red DUTY OUT with elapsed time when on-shift.
 *   2. My Flights today — cards for every assigned flight today + upcoming.
 *      Each card has Begin Preflight, sorted by ETD ascending.
 *   3. New Flight Log button — opens manual log creation flow (Spec 4
 *      §"Flight log management — manual flight log creation").
 *   4. Training currency summary — color-coded badges. Read-only here;
 *      pilots can't edit currency from this view.
 *   5. Quick links footer — My Flight History, My Duty History, etc.
 *
 * Where the data comes from:
 *   - Flights: `listFlights({ onDate, assignedToMe: true })` over a
 *     three-UTC-day window — the flights this pilot is actually
 *     rostered on. Three days because the server's UTC date is not the
 *     viewer's calendar day, and a single `onDate` hid a pilot's own
 *     evening flight from them; see the note at the fetch.
 *
 *     This panel used to pass no filter and show every flight in the
 *     tenant, because there was nothing to filter on: `flights` did not
 *     record its crew. The heading still said "My Flights today", and
 *     every row carried a Begin Preflight button, so a pilot could file
 *     a preflight against a flight someone else was flying.
 *     flight_crew_assignments (flightops-services#171) is the table that
 *     was missing; this is the other half.
 *   - Duty In/Out: live. DutyClockButton calls clockInAction /
 *     clockOutAction, which write duty periods. Described here as a
 *     stub awaiting a backend (timeclock table +
 *     endpoints, Spec 4 §"Duty time tracking") lands in the next PR.
 *   - Training currency: placeholder card. Spec 5's
 *     `calculate_currency_status()` + `pilot_currency_records` are the
 *     source; this card lights up once that surface ships.
 */
export default async function FlightCrewPage() {
  let flights: FlightListItem[] = [];
  let loadError: string | null = null;
  let unauthorized = false;

  const session = await auth();
  const firstName =
    firstNameFrom(session?.user?.name) ||
    firstNameFrom((session?.user?.email ?? "").split("@")[0]);
  const greeting = currentGreeting();

  let duty: CurrentDutyResponse = DUTY_OFFLINE_DEFAULT;

  try {
    // Three UTC days, not one, and the browser decides which of them
    // is "today".
    //
    // This used to be `onDate: new Date().toISOString().slice(0, 10)`,
    // which is the server's UTC date. The server cannot know the
    // viewer's time zone, so that date is wrong for anybody not on UTC
    // — and wrong in the direction that hides work. At 16:00 in
    // Alaska it is already tomorrow in UTC, so a pilot's evening flight
    // dropped off the page and the next day's appeared a day early,
    // with "You're not rostered on any flights today" in between and no
    // other route to a preflight anywhere on the page.
    //
    // Same fault as the fleet-board calendar arrows reported on 8/24,
    // for the same reason: a point in time used as a calendar date
    // across a time-zone boundary.
    //
    // A three-day window brackets every offset from UTC-12 to UTC+14,
    // so whatever the viewer's local day is, it is inside these
    // results. Grouping happens in TodayFlightsPanel, in the browser,
    // where the local day is actually known.
    const utcDayOffsets = [-1, 0, 1];
    const windowDates = utcDayOffsets.map((offset) => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + offset);
      return d.toISOString().slice(0, 10);
    });

    // Duty failure degrades the button to its default off-duty shape
    // rather than blocking the whole page.
    const [dutyResult, ...dayResults] = await Promise.all([
      getCurrentDuty().catch(() => DUTY_OFFLINE_DEFAULT),
      ...windowDates.map((onDate) =>
        listFlights({
          onDate,
          status: ["scheduled", "released"],
          assignedToMe: true,
          limit: 50,
        }),
      ),
    ]);
    // Sort by ETD ascending per Spec 4. De-duplicated by id: a flight
    // cannot appear on two UTC days, but a retry or an overlapping
    // window should not be able to double a card either.
    const byId = new Map(
      dayResults.flatMap((r) => r.items).map((f) => [f.id, f]),
    );
    flights = [...byId.values()].sort((a, b) =>
      a.scheduled_departure_at.localeCompare(b.scheduled_departure_at),
    );
    duty = dutyResult;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      loadError = "Your session expired — please sign in again.";
    } else if (err instanceof ApiError && err.status === 403) {
      unauthorized = true;
    } else {
      loadError = "Your schedule isn't reachable. Try refreshing.";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* Greeting */}
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
          Flight Crew
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {greeting}
          {firstName ? `, ${firstName}` : ""}
        </h1>
      </header>

      {/* 1. Duty In / Out — Spec 4 §"Page layout / Duty In / Out button" */}
      <section className="mb-6">
        <DutyClockButton initial={duty} />
      </section>

      {/* 2. My Flights today + 3. + Create Flight Log */}
      <section className="mb-8">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
            My Flights
          </h2>
          <Link
            href="/flight-crew/elog"
            className="text-xs font-semibold text-primary hover:underline"
          >
            + Create Flight Log
          </Link>
        </div>
        {unauthorized ? (
          <div
            role="alert"
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
          >
            You don&apos;t have permission to see the assigned-flights list.
          </div>
        ) : loadError ? (
          <div
            role="alert"
            className="rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
          >
            {loadError}
          </div>
        ) : (
          <TodayFlightsPanel flights={flights} />
        )}
      </section>

      {/* 4. Training currency summary */}
      <section className="mb-8">
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Training currency
        </h2>
        {session?.user?.id ? (
          <TrainingCurrencySummary pilotUserId={session.user.id} />
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-card/50 px-5 py-6 text-sm text-muted-foreground">
            Sign in to see your currency.
          </div>
        )}
      </section>

      {/* 5. Quick links — Spec 4 §"Page layout / Quick links" */}
      <section className="mt-10 border-t border-border pt-6">
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[0.68rem] font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          <li>
            <Link
              href="/flight-crew/history"
              className="hover:text-primary"
            >
              My Flight History
            </Link>
          </li>
          <li>
            <Link
              href="/flight-crew/history?tab=duty"
              className="hover:text-primary"
            >
              My Duty History
            </Link>
          </li>
          {/* Both of these shipped and stayed dimmed here. Documents
              has had its own department since M3; filing a safety
              report is the floating button on every page in the app,
              so this entry was telling a pilot they could not do
              something they could do from where they were standing. */}
          <li>
            <Link href="/documents" className="hover:text-primary">
              My Documents
            </Link>
          </li>
          {/* Labelled for what the page is. It was "File Safety Report"
              and dimmed; /safety/report files a hazard specifically,
              while the floating button on every page — including this
              one — covers all five types: safety concern, hazard, near
              miss, ASAP and incident. A link promising the broader
              surface and delivering the narrower one is the same
              overclaim as a dimmed link that works. */}
          <li>
            <Link href="/safety/report" className="hover:text-primary">
              File a Hazard
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}

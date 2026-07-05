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
 * Where the data comes from in M2:
 *   - Today's flights: `listFlights({ onDate: today })`. Spec ultimately
 *     wants per-PIC filtering; M3 adds flight_assignments. For now we
 *     show every scheduled/released flight today so the panel is
 *     non-empty in demos and pilots have a working preflight CTA.
 *   - Duty In/Out: stub button for this PR. Backend (timeclock table +
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
    const today = new Date().toISOString().slice(0, 10);
    // Fetch in parallel: today's flights + current duty state. Duty
    // failure degrades the button to its default off-duty shape rather
    // than blocking the whole page.
    const [flightsResult, dutyResult] = await Promise.all([
      listFlights({
        onDate: today,
        status: ["scheduled", "released"],
        limit: 50,
      }),
      getCurrentDuty().catch(() => DUTY_OFFLINE_DEFAULT),
    ]);
    // Sort by ETD ascending per Spec 4.
    flights = [...flightsResult.items].sort((a, b) =>
      a.scheduled_departure_at.localeCompare(b.scheduled_departure_at),
    );
    duty = dutyResult;
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      loadError = "Your session expired — please sign in again.";
    } else if (err instanceof ApiError && err.status === 403) {
      unauthorized = true;
    } else {
      loadError = "Today's schedule isn't reachable. Try refreshing.";
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
            My Flights today
          </h2>
          <Link
            href="/flight-crew/elog"
            className="text-xs font-semibold text-status-blue hover:underline"
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
              className="hover:text-status-blue"
            >
              My Flight History
            </Link>
          </li>
          <li>
            <Link
              href="/flight-crew/history?tab=duty"
              className="hover:text-status-blue"
            >
              My Duty History
            </Link>
          </li>
          <li>
            <span
              title="Coming in M3"
              className="cursor-not-allowed opacity-50"
            >
              My Documents
            </span>
          </li>
          <li>
            <span
              title="Coming in M3"
              className="cursor-not-allowed opacity-50"
            >
              File Safety Report
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}

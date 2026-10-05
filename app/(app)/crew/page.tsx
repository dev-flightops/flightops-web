import Link from "next/link";

import { auth } from "@/auth";
import { ApiError } from "@/lib/api/client";
import { getCrewCalendar, type CrewCalendar } from "@/lib/api/crew-calendar";
import { todayIsoDay } from "@/lib/iso-day";
import { CREW_SCHEDULERS, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { isValidMonth, monthLabel, monthOf, shiftMonth } from "./calendar-math";
import { CrewCalendarGrid } from "./crew-calendar-grid";

/**
 * /crew — the crew calendar. Legacy `templates/crew/calendar.html`,
 * which legacy titles "Crew Roster"; ours already has a Roster page (the
 * currency matrix), so this one is the Crew Calendar.
 *
 * A month of flight crew grouped by home base, each assignment a block
 * across its days: pilot × base × aircraft type, with a duty type. A
 * Chief Pilot, Director of Operations or Exec Admin adds, edits and
 * removes assignments and moves a pilot to another base; everyone else
 * reads it. Legacy let any signed-in user edit anyone's schedule.
 *
 * Under each pilot, a line of day tags: the company's own labels (FLY,
 * OFF, TRN…) painted one per day, as legacy's month view has them
 * (flightops-ops#44). Archiving a tag keeps the days painted with it.
 */

export const dynamic = "force-dynamic";

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function href(month: string, station: string | null): string {
  const qs = new URLSearchParams({ month });
  if (station) qs.set("station", station);
  return `/crew?${qs.toString()}`;
}

/** The bases in use, plus the one in the address if nothing uses it now. */
function baseChoices(bases: string[], station: string | null): string[] {
  return station && !bases.includes(station) ? [...bases, station].sort() : bases;
}

const NAV_LINK =
  "rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent";

export default async function CrewCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawMonth = first(params.month);
  const thisMonth = monthOf(todayIsoDay());
  const month = isValidMonth(rawMonth) ? rawMonth : thisMonth;
  const station = (first(params.station) ?? "").trim().toUpperCase() || null;
  const canEdit = hasAnyRole((await auth())?.roles ?? [], CREW_SCHEDULERS);

  let calendar: CrewCalendar | null = null;
  let loadError: string | null = null;
  try {
    calendar = await getCrewCalendar({ month, station });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 403
          ? "You don't have access to the crew calendar."
          : "The crew calendar is unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Crew Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is rostered where, on which aircraft type, and when.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Month" className="flex items-center gap-2">
          <Link href={href(shiftMonth(month, -1), station)} className={NAV_LINK} aria-label="Previous month">
            ←
          </Link>
          <h2 className="min-w-[10rem] text-center text-lg font-semibold">
            {monthLabel(month)}
          </h2>
          <Link href={href(shiftMonth(month, 1), station)} className={NAV_LINK} aria-label="Next month">
            →
          </Link>
          {month !== thisMonth && (
            <Link href={href(thisMonth, station)} className={NAV_LINK}>
              This month
            </Link>
          )}
        </nav>

        {calendar && calendar.bases.length > 0 && (
          <nav aria-label="Base" className="flex flex-wrap gap-1.5">
            {[null, ...baseChoices(calendar.bases, station)].map((code) => (
              <Link
                key={code ?? "all"}
                href={href(month, code)}
                aria-current={code === station ? "page" : undefined}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-semibold",
                  code === station
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card text-foreground hover:bg-accent",
                )}
              >
                {code ?? "All bases"}
              </Link>
            ))}
          </nav>
        )}
      </div>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : calendar && calendar.groups.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {station
            ? `No crew are based at or assigned to ${station} in ${monthLabel(month)}.`
            : "No crew yet. Pilots and crew members appear here once they have a login with the Pilot or Crew Member role."}
        </p>
      ) : calendar ? (
        <CrewCalendarGrid calendar={calendar} canEdit={canEdit} />
      ) : null}
    </div>
  );
}

import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
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

const NAV_LINK = cn(buttonOutline, "px-3 py-1.5");

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
      <PageHeader
        title="Crew Calendar"
        description="Who is rostered where, on which aircraft type, and when."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Month" className="flex items-center gap-2">
          <Link href={href(shiftMonth(month, -1), station)} className={NAV_LINK} aria-label="Previous month">
            ←
          </Link>
          <h2 className="min-w-[11rem] text-center font-display text-xl font-extrabold uppercase tracking-[0.03em]">
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
          <SegmentLinks
            label="Base"
            items={[null, ...baseChoices(calendar.bases, station)].map((code) => ({
              href: href(month, code),
              label: code ?? "All bases",
              active: code === station,
            }))}
          />
        )}
      </div>

      {loadError ? (
        <p
          role="alert"
          className="notice notice-red text-sm"
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

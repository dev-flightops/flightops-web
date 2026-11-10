import Link from "next/link";

import { auth } from "@/auth";
import { buttonOutline } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
import { isValidMonth, monthLabel, monthOf, shiftMonth } from "@/app/(app)/crew/calendar-math";
import { ApiError } from "@/lib/api/client";
import { getMxRoster, type MxRoster } from "@/lib/api/mx-roster";
import { MX_SHOP_STAFF, hasAnyRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

import { RosterGrid } from "./roster-grid";

/**
 * /maintenance/roster (#178): legacy's Mechanic Roster (/maintenance/calendar,
 * which redirects here). Each mechanic's month, one day tag a day, by base:
 * the crew calendar's day tags with a palette of their own.
 */

export const dynamic = "force-dynamic";

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function href(month: string, base: string | null): string {
  const qs = new URLSearchParams({ month });
  if (base) qs.set("base", base);
  return `/maintenance/roster?${qs.toString()}`;
}

const NAV_LINK = cn(buttonOutline, "px-3 py-1.5");

export default async function MechanicRosterPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawMonth = first(params.month);
  const base = (first(params.base) ?? "").trim().toUpperCase() || null;
  const canEdit = hasAnyRole((await auth())?.roles ?? [], MX_SHOP_STAFF);

  let roster: MxRoster | null = null;
  let loadError: string | null = null;
  try {
    roster = await getMxRoster({ month: isValidMonth(rawMonth) ? rawMonth : undefined, base: base ?? undefined });
  } catch (err) {
    loadError =
      err instanceof ApiError && err.status === 401
        ? "Your session expired — please sign in again."
        : "The roster is unavailable. Try refreshing in a moment.";
  }
  const month = roster?.month ?? (isValidMonth(rawMonth) ? rawMonth : null);
  const thisMonth = roster ? monthOf(roster.today) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Mechanic Roster"
        back={{ href: "/maintenance", label: "Fleet" }}
        description="Who in maintenance works which days, by base."
      />
      {month ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Month" className="flex items-center gap-2">
            <Link href={href(shiftMonth(month, -1), base)} className={NAV_LINK} aria-label="Previous month">
              ←
            </Link>
            <h2 className="min-w-[11rem] text-center font-display text-xl font-extrabold uppercase tracking-[0.03em]">
              {monthLabel(month)}
            </h2>
            <Link href={href(shiftMonth(month, 1), base)} className={NAV_LINK} aria-label="Next month">
              →
            </Link>
            {thisMonth && month !== thisMonth ? (
              <Link href={href(thisMonth, base)} className={NAV_LINK}>
                This month
              </Link>
            ) : null}
          </nav>
          {roster && roster.bases.length > 0 ? (
            <SegmentLinks
              label="Base"
              items={[null, ...roster.bases].map((code) => ({
                href: href(month, code),
                label: code ?? "All bases",
                active: code === base,
              }))}
            />
          ) : null}
        </div>
      ) : null}
      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : roster && roster.mechanics.length === 0 ? (
        <p className="rounded-lg border border-border bg-card px-4 py-6 text-sm text-muted-foreground">
          {base
            ? `No mechanics are based at ${base}.`
            : "No mechanics yet. Staff appear here once they have the Maintenance or Director of Maintenance role, or work in the maintenance department."}
        </p>
      ) : roster ? (
        <RosterGrid roster={roster} canEdit={canEdit} />
      ) : null}
    </div>
  );
}

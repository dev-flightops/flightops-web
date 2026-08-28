import { ApiError } from "@/lib/api/client";
import { getPilotRoster } from "@/lib/api/ops";
import type { PilotRosterResponse } from "@/lib/api/types";

import { RosterTable } from "./roster-table";

/**
 * /compliance/roster — the FAR 135 pilot roster.
 *
 * The legacy system's /crew/roster, which despite the name is a
 * currency-and-qualification matrix grouped by home base with flight
 * totals beside it, not a shift roster.
 *
 * Currency comes from the same records the compliance board renders, so
 * the roster and the board cannot disagree about whether a pilot is
 * current. Flight time is the 135.265 evaluation — the same one the
 * release gate blocks on, so what a chief pilot reads here is what a
 * dispatcher will hit when they try to release.
 */

export const dynamic = "force-dynamic";

export default async function PilotRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ station?: string }>;
}) {
  const { station } = await searchParams;

  let roster: PilotRosterResponse | null = null;
  let loadError: string | null = null;
  try {
    roster = await getPilotRoster(station);
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "The roster is unavailable. Try refreshing in a moment.";
  }

  const stations = Array.from(
    new Set(
      (roster?.groups ?? [])
        .map((g) => g.station)
        .filter((s): s is string => Boolean(s)),
    ),
  );
  const overLimit = (roster?.groups ?? [])
    .flatMap((g) => g.rows)
    .filter((r) => r.flight_time_exceeded).length;

  return (
    <div className="mx-auto max-w-[100rem] px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Pilot Roster</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Crew currency and FAR 135.265 flight-time position, by base.
        </p>
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-3 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : (
        <>
          {overLimit > 0 ? (
            <p
              role="status"
              className="mb-4 rounded-lg border border-status-red/40 bg-status-red/10 px-4 py-2.5 text-sm text-status-red"
            >
              <strong className="font-semibold">
                {overLimit} pilot{overLimit === 1 ? " is" : "s are"} out of
                flight-time hours.
              </strong>{" "}
              A release naming {overLimit === 1 ? "them" : "any of them"} will
              be refused — 135.265 carries no override.
            </p>
          ) : null}

          {stations.length > 1 ? (
            <nav
              aria-label="Filter by base"
              className="mb-4 flex flex-wrap items-center gap-1.5 text-xs"
            >
              <FilterChip href="/compliance/roster" active={!station}>
                All bases
              </FilterChip>
              {stations.map((s) => (
                <FilterChip
                  key={s}
                  href={`/compliance/roster?station=${encodeURIComponent(s)}`}
                  active={station === s}
                >
                  {s}
                </FilterChip>
              ))}
            </nav>
          ) : null}

          <RosterTable
            items={roster?.items ?? []}
            groups={roster?.groups ?? []}
          />
        </>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        "rounded-md border px-2.5 py-1 font-semibold transition " +
        (active
          ? "border-status-blue/50 bg-status-blue/15 text-status-blue"
          : "border-border bg-card text-muted-foreground hover:text-foreground")
      }
    >
      {children}
    </a>
  );
}

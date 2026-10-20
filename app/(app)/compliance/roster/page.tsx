import { PageHeader } from "@/components/ff/page-header";
import { SegmentLinks } from "@/components/ff/segment-links";
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
    <div className="mx-auto max-w-[100rem] px-4 py-8 sm:px-6">
      <PageHeader
        title="Pilot Roster"
        description="Crew currency and FAR 135.265 flight-time position, by base."
      />

      {loadError ? (
        <p
          role="alert"
          className="notice notice-red text-sm"
        >
          {loadError}
        </p>
      ) : (
        <>
          {overLimit > 0 ? (
            <p
              role="status"
              className="mb-4 notice notice-red text-sm"
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
            <SegmentLinks
              label="Filter by base"
              className="mb-4"
              items={[
                { href: "/compliance/roster", label: "All bases", active: !station },
                ...stations.map((s) => ({
                  href: `/compliance/roster?station=${encodeURIComponent(s)}`,
                  label: s,
                  active: station === s,
                })),
              ]}
            />
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

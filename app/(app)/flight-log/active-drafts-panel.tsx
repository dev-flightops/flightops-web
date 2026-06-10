import Link from "next/link";

import type { FlightLogResponse } from "@/lib/api/types";

/**
 * "Active Logs (Draft)" panel on the elog landing (M2-G-26b).
 *
 * Mirrors the legacy peregrineflight.com/elog/ active-drafts list:
 * a yellow-tinted card per draft log with the LOG-… number, tail,
 * flight date, and a DRAFT pill. Empty list collapses the whole
 * panel — the legacy hides it entirely too.
 *
 * Each row links to /flight-log/{id} which lands on the stub page
 * until the M3 7-tab detail ships.
 */
export function ActiveDraftsPanel({
  drafts,
}: {
  drafts: FlightLogResponse[];
}) {
  if (drafts.length === 0) return null;

  return (
    <section className="rounded-lg border border-status-yellow/40 bg-status-yellow/[0.05] p-4">
      <h2 className="mb-2 text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-status-yellow">
        Active Logs (Draft)
      </h2>
      <ul className="space-y-1.5">
        {drafts.map((log) => (
          <li key={log.id}>
            <Link
              href={`/flight-log/${log.id}`}
              className="flex items-center justify-between gap-3 rounded-md border border-status-yellow/20 bg-card px-3 py-2 hover:border-status-yellow/40"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-mono text-sm font-bold text-foreground">
                  {log.log_number}
                </span>
                <span className="ml-2 font-mono text-xs text-status-blue">
                  {log.aircraft.tail_number}
                </span>
                <span className="ml-2 text-[0.65rem] text-muted-foreground">
                  · {log.flight_date}
                </span>
              </div>
              <span className="rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow">
                Draft
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

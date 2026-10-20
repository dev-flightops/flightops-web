import Link from "next/link";

import { Panel } from "@/components/ff/panel";
import type { FlightLogResponse } from "@/lib/api/types";

/**
 * "Active Logs (Draft)" panel on the elog landing (M2-G-26b).
 *
 * Mirrors the legacy peregrineflight.com/elog/ active-drafts list:
 * a card per draft log with the LOG-… number, tail,
 * flight date, and a DRAFT pill. Empty list collapses the whole
 * panel — the legacy hides it entirely too.
 *
 * Each row links to /flight-crew/elog/{id} — the 7-tab page shell
 * (Tab 1 wired up, Tabs 2/3/5/6/7 stubbed for follow-ups).
 */
export function ActiveDraftsPanel({
  drafts,
}: {
  drafts: FlightLogResponse[];
}) {
  if (drafts.length === 0) return null;

  return (
    // A panel like every other list (#81), its drafts as rows; the amber
    // stays on the Draft marks, where it means "not submitted yet".
    <Panel title="Active Logs (Draft)" flush>
      <ul className="divide-y divide-border">
        {drafts.map((log) => (
          <li key={log.id}>
            <Link
              href={`/flight-crew/elog/${log.id}`}
              className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-accent"
            >
              <div className="min-w-0 flex-1 truncate">
                <span className="font-mono text-sm font-bold text-foreground">
                  {log.log_number}
                </span>
                <span className="ml-3 font-mono text-xs text-muted-foreground">
                  {log.aircraft.tail_number}
                </span>
                <span className="ml-2 text-[0.7rem] text-muted-foreground">
                  · {log.flight_date}
                </span>
              </div>
              <span className="status-mark text-status-yellow">
                Draft
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

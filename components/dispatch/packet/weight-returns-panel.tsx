import Link from "next/link";

import type { WeightReturn } from "@/lib/api/types";

/**
 * Flights a pilot has handed back over weight.
 *
 * This is the other half of removing the max-gross-weight override from
 * preflight step 2 (client bug report 8/24, restated 8/25). The pilot can
 * no longer sign an exceedance and go; they state the payload they can
 * accept and the flight lands here for dispatch to re-plan.
 *
 * Deliberately loud when non-empty and absent when empty: a flight sitting
 * in this list is not going anywhere until someone acts on it, so it
 * should not read as one more panel to scroll past. It renders nothing at
 * all when there is nothing held back.
 */
export function WeightReturnsPanel({ returns }: { returns: WeightReturn[] }) {
  if (returns.length === 0) return null;

  return (
    <section className="rounded-xl border border-status-red/40 bg-status-red/5">
      <header className="flex items-center justify-between border-b border-status-red/20 px-4 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.06em] text-status-red">
          Returned over weight
        </h2>
        <span className="rounded-md border border-status-red/40 bg-status-red/10 px-2 py-0.5 text-xs font-semibold text-status-red">
          {returns.length}
        </span>
      </header>

      <ul className="divide-y divide-status-red/10">
        {returns.map((r) => (
          <li key={r.id} className="px-4 py-3 text-xs">
            <div className="flex items-baseline justify-between gap-3">
              <Link
                href={`/dispatch?flight=${r.flight_id}`}
                className="font-semibold text-foreground underline-offset-2 hover:underline"
              >
                {r.pilot_name ?? "Pilot"}
              </Link>
              <span className="font-mono font-semibold text-status-red">
                max {Number(r.max_payload_lbs).toLocaleString()} lbs
              </span>
            </div>
            {r.note && (
              <p className="mt-1 italic text-muted-foreground">“{r.note}”</p>
            )}
            <p className="mt-1 text-[0.65rem] text-muted-foreground">
              Re-plan the load to this figure or lighter, then mark it
              re-planned on the flight.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

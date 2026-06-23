import type { DutyPeriodSummary } from "@/lib/api/types";

/**
 * Duty tab table on the My History page.
 *
 * MVP columns: Date / Duty In / Duty Out / Elapsed / Status.
 *
 * Status here is intentionally light — Open vs Closed only. The
 * legacy "Violation / Short Rest / Normal" classification needs the
 * tenant's configured limits + a rest-since calc per row; both ship
 * in a follow-up so this MVP stays a clean viewer.
 */
export function DutyHistoryTable({
  periods,
}: {
  periods: DutyPeriodSummary[];
}) {
  if (periods.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">No duty periods on file.</p>
        <p className="mt-2 text-xs text-muted-foreground/80">
          Clock In from the Flight Crew page once you start your day.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-border bg-card/60 text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Duty In</th>
            <th className="px-3 py-2">Duty Out</th>
            <th className="px-3 py-2">Elapsed</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {periods.map((p) => (
            <tr
              key={p.id}
              className="border-b border-border/60 last:border-b-0"
            >
              <td className="px-3 py-2 font-mono">{dateOnly(p.clock_in_at)}</td>
              <td className="px-3 py-2 font-mono">
                {timeOnly(p.clock_in_at)}z
              </td>
              <td className="px-3 py-2 font-mono">
                {p.clock_out_at ? `${timeOnly(p.clock_out_at)}z` : "OPEN"}
              </td>
              <td className="px-3 py-2 font-semibold">
                {p.elapsed_hours.toFixed(1)}h
              </td>
              <td className="px-3 py-2">
                <StatusBadge isOpen={p.is_open} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatusBadge({ isOpen }: { isOpen: boolean }) {
  if (isOpen) {
    return (
      <span className="rounded bg-status-yellow/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-yellow">
        Open
      </span>
    );
  }
  return (
    <span className="rounded bg-status-green/15 px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-status-green">
      Closed
    </span>
  );
}

/** ISO 8601 → YYYY-MM-DD (always UTC since the API stamps UTC). */
function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

/** ISO 8601 → HH:MM (UTC). */
function timeOnly(iso: string): string {
  return iso.slice(11, 16);
}

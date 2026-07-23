import Link from "next/link";

/**
 * /maintenance/mx-clock — legacy `templates/maintenance/mx_clock.html`.
 *
 * Track aircraft maintenance time with milestones. Sections:
 *   1. Begin Maintenance form (aircraft select + WO # + notes + Begin
 *      Work) — currently disabled shell
 *   2. Active clocks — each shows elapsed hours, mechanics chips,
 *      Join/Leave, milestone chips (Aircraft Pulled → Inspection Started
 *      → Parts Installed → Test Run Complete → Ready for RTS), and a
 *      Complete button
 *   3. Recently Completed table (Aircraft · Started · Completed · Total
 *      Hours · Started By)
 *
 * Backend not shipped — Marc's M2 maintenance-service MX Clock endpoints
 * still to land. Wired to the empty state today; swap to `listMxClocks`
 * once the endpoints exist.
 */

const MILESTONES = [
  { key: "aircraft_pulled", label: "Aircraft Pulled" },
  { key: "inspection_started", label: "Inspection Started" },
  { key: "parts_installed", label: "Parts Installed" },
  { key: "test_run_complete", label: "Test Run Complete" },
  { key: "ready_for_rts", label: "Ready for RTS" },
] as const;

const BACKEND_HINT = "MX Clock ships with the maintenance-service (M2 backend)";

export default function MxClockPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Maintenance Clock</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Track aircraft maintenance time with milestones
          </p>
        </div>
        <Link
          href="/maintenance/availability"
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
        >
          Availability Report
        </Link>
      </header>

      <div className="mb-5 rounded-lg border border-border bg-card px-4 py-4">
        <div className="mb-3 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
          Begin Maintenance
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[160px]">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Aircraft
            </span>
            <select
              disabled
              aria-disabled="true"
              title={BACKEND_HINT}
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-100"
            >
              <option>Select…</option>
            </select>
          </label>
          <label className="min-w-[120px]">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Work Order (optional)
            </span>
            <input
              type="text"
              disabled
              placeholder="WO #"
              title={BACKEND_HINT}
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-100"
            />
          </label>
          <label className="min-w-[200px] flex-1">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Notes
            </span>
            <input
              type="text"
              disabled
              placeholder="What are you working on?"
              title={BACKEND_HINT}
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-100"
            />
          </label>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-green px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
          >
            Begin Work
          </button>
        </div>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-status-green">
        Active (0)
      </h2>
      <div className="mb-6 rounded-lg border border-border bg-card px-4 py-10 text-center">
        <p className="text-sm text-muted-foreground">
          No active maintenance clocks. Select an aircraft above and click Begin Work.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-1">
          {MILESTONES.map((m) => (
            <span
              key={m.key}
              className="rounded border border-border bg-muted/20 px-2 py-1 text-[0.65rem] font-semibold text-muted-foreground"
            >
              {m.label}
            </span>
          ))}
        </div>
      </div>

      <h2 className="mb-3 text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
        Recently Completed
      </h2>
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2 font-semibold">Started</th>
                <th scope="col" className="px-4 py-2 font-semibold">Completed</th>
                <th scope="col" className="px-4 py-2 font-semibold">Total Hours</th>
                <th scope="col" className="px-4 py-2 font-semibold">Started By</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No completed maintenance clocks yet.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/**
 * /payroll — Pay Events.
 *
 * Matches legacy peregrineflight.com/payroll/ shell:
 *   Sub-nav:  🏠 › HR · Payroll (active) · Time Clock · Records
 *             (rendered by the AppShell DepartmentNav — /payroll is
 *             in the "hr" dept's pathPrefixes)
 *   Header:   "Pay Events" + "N event(s)"  |  Pay Periods · + New
 *             Pay Event
 *   Empty:    "No pay events found."
 *
 * There is no payroll-service yet — Marc's HR/Payroll M3 backend
 * story owns the pay-event tables + pay-period model + payroll-run
 * generation. This page renders the shell so the sub-nav's Payroll
 * chip can flip to live; buttons render disabled with milestone
 * tooltips.
 */

const PAYROLL_BACKEND_HINT =
  "Payroll ships with the payroll-service (M3 backend)";

export default function PayrollPage() {
  const total: number = 0;
  return (
    <div className="w-full px-4 py-6 sm:px-6">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Pay Events</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {total} event{total === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={PAYROLL_BACKEND_HINT}
            className="cursor-not-allowed rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground disabled:opacity-100"
          >
            Pay Periods
          </button>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title={PAYROLL_BACKEND_HINT}
            className="cursor-not-allowed rounded-md bg-status-blue px-3 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            + New Pay Event
          </button>
        </div>
      </header>

      <div className="rounded-lg border border-border bg-card px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          No pay events found.
        </p>
      </div>
    </div>
  );
}

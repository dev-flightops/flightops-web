import Link from "next/link";

/**
 * /maintenance/availability — legacy
 * `templates/maintenance/availability_report.html`.
 *
 * Aircraft Revenue Availability report. Date range filter + fleet
 * summary stat cards (Fleet Availability % · Revenue Hours · MX
 * Hours) + per-aircraft table (Aircraft · Availability bar+% ·
 * Revenue Hrs · MX Hrs · Ferry Hrs · Idle Hrs · Flights · MX Events
 * · Status). Availability status coloured green ≥90 %, yellow ≥75 %,
 * red below.
 *
 * Backend not shipped — Marc's M2 maintenance-service availability
 * roll-up query still to land. Rendering the shell with all stat
 * cards + full column set; swap to real data
 * (`getAvailabilityReport({ start, end })`) once the endpoint lands.
 */
export default function AvailabilityPage() {
  const fleetAvail = 0;
  const fleetRevenueHours = 0;
  const fleetMxHours = 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <header className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Aircraft Revenue Availability</h1>
          <p className="mt-0.5 text-xs text-muted-foreground">
            30 day period · Time to produce revenue metric
          </p>
        </div>
        <Link
          href="/maintenance/mx-clock"
          className="rounded-md border border-border bg-card px-3 py-2 text-xs font-semibold text-foreground hover:bg-muted/30"
        >
          MX Clock
        </Link>
      </header>

      <div className="mb-4 rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="min-w-[140px]">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              From
            </span>
            <input
              type="date"
              disabled
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-100"
              title="Availability roll-up ships with the maintenance-service (M2 backend)"
            />
          </label>
          <label className="min-w-[140px]">
            <span className="mb-1.5 block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              To
            </span>
            <input
              type="date"
              disabled
              className="w-full cursor-not-allowed rounded-md border border-border bg-background px-3 py-2 text-sm disabled:opacity-100"
              title="Availability roll-up ships with the maintenance-service (M2 backend)"
            />
          </label>
          <button
            type="button"
            disabled
            aria-disabled="true"
            title="Availability roll-up ships with the maintenance-service (M2 backend)"
            className="cursor-not-allowed rounded-md bg-status-blue px-4 py-2 text-xs font-semibold text-white disabled:opacity-100"
          >
            Update
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-4">
        <StatCard label="Fleet Availability" value={`${fleetAvail}%`} color="green" />
        <StatCard label="Revenue Hours" value={String(fleetRevenueHours)} color="green" />
        <StatCard label="Maintenance Hours" value={String(fleetMxHours)} color="yellow" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2 font-semibold">Availability</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Revenue Hrs</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">MX Hrs</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Ferry Hrs</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Idle Hrs</th>
                <th scope="col" className="px-4 py-2 text-center font-semibold">Flights</th>
                <th scope="col" className="px-4 py-2 text-center font-semibold">MX Events</th>
                <th scope="col" className="px-4 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  Availability data ships with the maintenance-service (M2). Per-aircraft status is available today on /maintenance (Fleet tab).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "green" | "yellow" | "red";
}) {
  const valueCls = {
    green: "text-status-green",
    yellow: "text-status-yellow",
    red: "text-status-red",
  }[color];
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4 text-center">
      <div className={"text-2xl font-bold " + valueCls}>{value}</div>
      <div className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

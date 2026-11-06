import Link from "next/link";

import { buttonSolid, buttonOutline } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import { PageHeader } from "@/components/ff/page-header";
import { Stat, StatStrip, type StatTone } from "@/components/ff/stat-strip";
import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { ApiError } from "@/lib/api/client";
import { getAvailability, type AvailabilityReport, type AvailabilityRow } from "@/lib/api/maintenance";
import { refusalText } from "@/lib/api/validation-errors";
import { cn } from "@/lib/utils";

/**
 * /maintenance/availability (#172), legacy's availability_report.html: how much of
 * a period each aircraft could have flown, and what it did with it. Green at 90%,
 * yellow at 75%, red below. Where the figures depart from legacy's is at the top of
 * services/maintenance/app/routes/availability.py.
 */

export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string {
  const day = (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : "";
}

function tone(pct: number): "green" | "yellow" | "red" {
  return pct >= 90 ? "green" : pct >= 75 ? "yellow" : "red";
}

const STATUS: Record<AvailabilityRow["status"], { label: string; tone: StatusTone }> = {
  in_mx: { label: "In MX", tone: "yellow" },
  on_hold: { label: "RTS Hold", tone: "red" },
  available: { label: "Available", tone: "green" },
};

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const start = one(params.start);
  const end = one(params.end);
  let report: AvailabilityReport | null = null;
  let loadError: string | null = null;
  try {
    report = await getAvailability({ start, end });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 422 && err instanceof ApiError
          ? (refusalText(err) ?? "Check the dates.")
          : "The availability report is unavailable. Try refreshing in a moment.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <PageHeader
        title="Aircraft Revenue Availability"
        back={{ href: "/maintenance", label: "Fleet" }}
        description={report ? `${report.period_days} day period · The time each aircraft was free to produce revenue.` : null}
        actions={
          <Link href="/maintenance/mx-clock" className={buttonOutline}>
            MX Clock
          </Link>
        }
      />

      <form method="get" action="/maintenance/availability" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="availability-start" className="field-label">
            From
          </label>
          <input id="availability-start" name="start" type="date" defaultValue={report?.start ?? start} className="ff-input px-3 py-2 text-sm" />
        </div>
        <div>
          <label htmlFor="availability-end" className="field-label">
            To
          </label>
          <input id="availability-end" name="end" type="date" defaultValue={report?.end ?? end} className="ff-input px-3 py-2 text-sm" />
        </div>
        <button type="submit" className={buttonSolid}>
          Update
        </button>
      </form>

      {loadError ? (
        <Notice tone="yellow" role="alert">
          {loadError}
        </Notice>
      ) : report ? (
        <>
          <StatStrip label="Fleet summary">
            <Stat value={`${report.fleet_availability_pct}%`} label="Fleet Availability" tone={tone(report.fleet_availability_pct) as StatTone} />
            <Stat value={report.revenue_hours} label="Revenue Hours" tone="green" />
            <Stat value={report.mx_hours} label="Maintenance Hours" tone="yellow" />
          </StatStrip>
          {report.rows.length === 0 ? (
            <p className="rounded-lg border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
              No active aircraft.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="ff-table w-full text-sm">
                <thead className="ff-thead">
                  <tr>
                    <th>Aircraft</th>
                    <th>Availability</th>
                    <th className="text-right">Revenue Hrs</th>
                    <th className="text-right">MX Hrs</th>
                    <th className="text-right">Non-rev Hrs</th>
                    <th className="text-right">Idle Hrs</th>
                    <th className="text-right">Flights</th>
                    <th className="text-right">MX Events</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const band = tone(row.availability_pct);
                    return (
                      <tr key={row.aircraft_id}>
                        <td>
                          <Link href={`/maintenance/aircraft/${row.aircraft_id}`} className="font-mono font-bold text-primary hover:underline">
                            {row.tail_number}
                          </Link>
                          {row.model ? <span className="block text-xs text-muted-foreground">{row.model}</span> : null}
                        </td>
                        <td>
                          <span className="flex items-center gap-2">
                            <span aria-hidden className="h-1.5 w-16 overflow-hidden rounded-sm bg-muted">
                              <span
                                className={cn(
                                  "block h-full",
                                  band === "green" ? "bg-status-green" : band === "yellow" ? "bg-status-yellow" : "bg-status-red",
                                )}
                                style={{ width: `${Math.min(row.availability_pct, 100)}%` }}
                              />
                            </span>
                            <span className={cn("font-mono font-bold", `text-status-${band}`)}>{row.availability_pct}%</span>
                          </span>
                        </td>
                        <td className="text-right font-mono">{row.revenue_hours}</td>
                        <td className="text-right font-mono">{row.mx_hours}</td>
                        <td className="text-right font-mono text-muted-foreground">{row.non_revenue_hours}</td>
                        <td className="text-right font-mono text-muted-foreground">{row.idle_hours}</td>
                        <td className="text-right font-mono">{row.flights}</td>
                        <td className="text-right font-mono">{row.mx_events}</td>
                        <td>
                          <StatusMark label={STATUS[row.status].label} tone={STATUS[row.status].tone} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">
            Availability is the period less the time on the Maintenance Clock. Revenue hours are real flight
            hours: a filed log&apos;s block times, or else the check-in times. Non-revenue is ferry, training,
            checkride and maintenance check flights, by the log&apos;s flight type.
          </p>
        </>
      ) : null}
    </div>
  );
}

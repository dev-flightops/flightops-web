import { ApiError } from "@/lib/api/client";
import { getDot41Report, type Dot41Report } from "@/lib/api/reports";
import {
  FilingAdvisory,
  FilingHeader,
  FilingLoadError,
  FilingTable,
  NotMeasuredNotice,
  Pct,
  TD,
  TD_NUM,
  TH_CLASS,
} from "@/components/reports/filing-chrome";
import { QuarterlyFilingControls } from "@/components/reports/filing-controls";

import { downloadDot41CsvAction } from "../actions";
import { resolveQuarter } from "../period";

/**
 * /reports/regulatory/dot41 — quarterly operating statistics.
 *
 * Legacy's `reports/dot41_report.html`: a block of statistics for the
 * quarter, then a table by aircraft type. The only quarterly return of
 * the five.
 *
 * Block hours are the figure to be careful with. Legacy totals them
 * from crew duty records, so a leg flown by a PIC and an SIC counts
 * twice. Ours come off the flight's own actual times, and flights
 * whose times cannot be true — over a day in the air, or arriving
 * before departing — contribute nothing and are declared above the
 * figure instead. The demo tenant holds one such flight: 246 hours,
 * which was 88% of the quarter's reported hours on its own.
 */

export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <p className="text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-foreground">
        {value}
      </p>
      {hint && (
        <p className="mt-0.5 text-[0.7rem] text-muted-foreground">{hint}</p>
      )}
    </div>
  );
}

function money(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

export default async function Dot41Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string }>;
}) {
  const period = resolveQuarter(await searchParams);

  let report: Dot41Report | null = null;
  let loadError: string | null = null;
  try {
    report = period
      ? await getDot41Report(period.year, period.quarter)
      : await getDot41Report();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Regulatory filings are limited to executive admins and the director of operations."
        : "Could not load the report just now.";
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <FilingHeader
        title="DOT Form 41 — Operating Statistics"
        subtitle={
          report
            ? `${report.period_label} · ${report.total_flights} flights, ${report.block_hours.toLocaleString("en-US")} block hours`
            : undefined
        }
        controls={
          report && (
            <QuarterlyFilingControls
              basePath="/reports/regulatory/dot41"
              filePrefix="dot41"
              year={report.year}
              quarter={report.quarter}
              hasRows={report.total_flights > 0}
              downloadAction={downloadDot41CsvAction}
            />
          )
        }
      />

      {loadError ? (
        <FilingLoadError message={loadError} />
      ) : report ? (
        <>
          <FilingAdvisory text={report.advisory} />

          {(report.flights_with_implausible_times > 0 ||
            report.flights_without_times > 0) && (
            <NotMeasuredNotice>
              Block hours are a floor.{" "}
              {report.flights_without_times > 0 && (
                <>
                  {report.flights_without_times} completed flight
                  {report.flights_without_times === 1 ? " has" : "s have"} no
                  recorded times.{" "}
                </>
              )}
              {report.flights_with_implausible_times > 0 && (
                <>
                  {report.flights_with_implausible_times} flight
                  {report.flights_with_implausible_times === 1 ? " has" : "s have"}{" "}
                  times that cannot be true — longer than a day in the air, or
                  arriving before departing — and{" "}
                  {report.flights_with_implausible_times === 1 ? "was" : "were"}{" "}
                  excluded rather than summed. Correct{" "}
                  {report.flights_with_implausible_times === 1 ? "it" : "them"} in
                  the flight record and the figure will rise.
                </>
              )}
            </NotMeasuredNotice>
          )}

          <h2 className="mb-2 mt-5 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Flight operations
          </h2>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <Stat label="Total flights" value={report.total_flights} />
            <Stat label="Completed" value={report.completed} />
            <Stat label="Cancelled" value={report.cancelled} />
            <Stat
              label="Completion"
              value={<Pct value={report.completion_pct} />}
            />
            <Stat
              label="Block hours"
              value={report.block_hours.toLocaleString("en-US")}
              hint="from actual out/in times"
            />
          </div>

          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            Traffic
          </h2>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Stat
              label="Revenue passengers"
              value={report.revenue_passengers}
              hint={`of ${report.total_passengers} carried`}
            />
            <Stat
              label="Passenger weight"
              value={`${report.passenger_weight_lbs.toLocaleString("en-US")} lb`}
              hint="crew excluded"
            />
            <Stat
              label="Baggage"
              value={`${report.baggage_weight_lbs.toLocaleString("en-US")} lb`}
            />
            <Stat
              label="Freight"
              value={`${report.cargo_weight_lbs.toLocaleString("en-US")} lb`}
              hint="cargo that is not mail"
            />
            <Stat
              label="Mail"
              value={`${report.mail_weight_lbs.toLocaleString("en-US")} lb`}
              hint={`${report.mail_pieces.toLocaleString("en-US")} pieces`}
            />
            <Stat
              label="Quoted revenue"
              value={money(report.quoted_revenue_cents)}
              hint="quoted, not invoiced"
            />
            <Stat
              label="Aircraft in fleet"
              value={report.aircraft_in_fleet}
              // Stated rather than folded in. Half this demo fleet is
              // grounded, and a bare "4" under a fleet heading invites
              // the reader to assume that is the whole fleet.
              hint={
                report.aircraft_grounded > 0
                  ? `${report.aircraft_grounded} grounded, counted separately`
                  : "none grounded"
              }
            />
          </div>

          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            By aircraft type
          </h2>
          {report.aircraft_types.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-10 text-center text-sm text-muted-foreground">
              No flights on file for {report.period_label}.
            </p>
          ) : (
            <FilingTable
              caption={`DOT Form 41 aircraft types for ${report.period_label}`}
            >
              <thead>
                <tr className={TH_CLASS}>
                  <th scope="col" className="px-4 py-3">
                    Type
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Aircraft
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Flights
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Completed
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Block hours
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.aircraft_types.map((t) => (
                  <tr
                    key={t.aircraft_type}
                    className="border-b border-border last:border-0"
                  >
                    <td className={`${TD} uppercase`}>{t.aircraft_type}</td>
                    <td className={TD_NUM}>{t.aircraft_count}</td>
                    <td className={TD_NUM}>{t.flights}</td>
                    <td className={TD_NUM}>{t.completed}</td>
                    <td className={TD_NUM}>
                      {t.block_hours.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background/40 font-semibold">
                  <td className={`${TD} text-muted-foreground`}>Total</td>
                  <td className={TD_NUM}>
                    {/* Aircraft that flew in the quarter, which is not
                        the fleet count above: a type with no flights
                        contributes no row, and a grounded aircraft that
                        flew earlier still appears here. */}
                    {report.aircraft_types.reduce(
                      (n, t) => n + t.aircraft_count,
                      0,
                    )}
                  </td>
                  <td className={TD_NUM}>{report.total_flights}</td>
                  <td className={TD_NUM}>{report.completed}</td>
                  <td className={TD_NUM}>
                    {report.block_hours.toLocaleString("en-US")}
                  </td>
                </tr>
              </tfoot>
            </FilingTable>
          )}
        </>
      ) : null}
    </div>
  );
}

import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import { getT100Report, type T100Report } from "@/lib/api/reports";

import { MonthlyFilingControls } from "@/components/reports/filing-controls";

import { downloadT100CsvAction } from "../actions";

/**
 * /reports/regulatory/t100 — mail traffic by route and class.
 *
 * Legacy's `reports/t100_report.html`: a table of origin, destination,
 * class, departures, weight and pieces for one month, with a CSV
 * export beside it.
 *
 * Everything on this page is arithmetic over locked manifests. There
 * is no model involved and nothing on it is an opinion — which is why
 * it reads differently from the AI pages: no advisory about human
 * review of a judgement, just a note about what was and was not
 * counted.
 *
 * The period defaults to the month just gone, which the service
 * decides. A page whose output gets filed should not open on a partial
 * month that looks like a total.
 */

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{1,2}$/;
const YEAR_RE = /^\d{4}$/;

export default async function T100Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const { year: yearParam, month: monthParam } = await searchParams;

  // Both or neither, matching the service. Passing half a period would
  // have it fill in the other half from today and report a month
  // nobody asked for.
  const bothGiven =
    yearParam !== undefined &&
    monthParam !== undefined &&
    YEAR_RE.test(yearParam) &&
    MONTH_RE.test(monthParam) &&
    Number(monthParam) >= 1 &&
    Number(monthParam) <= 12;

  let report: T100Report | null = null;
  let loadError: string | null = null;

  try {
    report = bothGiven
      ? await getT100Report(Number(yearParam), Number(monthParam))
      : await getT100Report();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Regulatory filings are limited to executive admins and the director of operations."
        : "Could not load the report just now.";
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href="/reports"
            className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            ← Reports
          </Link>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            T-100 — Mail Traffic
          </h1>
          {report && (
            <p className="mt-1 text-sm text-muted-foreground">
              {report.period_label} · {report.total_departures} departure
              {report.total_departures === 1 ? "" : "s"} carrying mail
            </p>
          )}
        </div>
        {report && (
          <MonthlyFilingControls
            basePath="/reports/regulatory/t100"
            filePrefix="t100"
            year={report.year}
            month={report.month}
            hasRows={report.rows.length > 0}
            downloadAction={downloadT100CsvAction}
          />
        )}
      </header>

      {loadError ? (
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          {loadError}
        </p>
      ) : report ? (
        <>
          <p className="mb-4 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
            {report.advisory}
          </p>

          {report.draft_manifests_excluded > 0 && (
            // The service counts these so the page can say it. A
            // filing compiled from records that can still change ought
            // to announce that before it is filed, not after.
            <p
              role="status"
              className="mb-4 rounded-md border border-status-yellow/30 bg-status-yellow/10 px-3 py-2 text-xs text-status-yellow"
            >
              {report.draft_manifests_excluded} manifest
              {report.draft_manifests_excluded === 1 ? " is" : "s are"} still in
              draft for this month and{" "}
              {report.draft_manifests_excluded === 1 ? "its" : "their"} mail is
              not counted below. Lock{" "}
              {report.draft_manifests_excluded === 1 ? "it" : "them"} before
              filing.
            </p>
          )}

          {report.rows.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border bg-card/40 px-4 py-16 text-center text-sm text-muted-foreground">
              No mail carried on a locked manifest in {report.period_label}.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full text-sm">
                <caption className="sr-only">
                  T-100 mail traffic for {report.period_label}
                </caption>
                <thead>
                  <tr className="border-b border-border bg-background/40 text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    <th scope="col" className="px-4 py-3">
                      Origin
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Destination
                    </th>
                    <th scope="col" className="px-4 py-3">
                      Class
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Departures
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Weight (lbs)
                    </th>
                    <th scope="col" className="px-4 py-3 text-right">
                      Pieces
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r) => (
                    <tr
                      key={`${r.origin}-${r.destination}-${r.mail_class}`}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-2.5 font-mono text-foreground">
                        {r.origin}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-foreground">
                        {r.destination}
                      </td>
                      <td className="px-4 py-2.5 text-foreground">
                        {r.mail_class_label}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.departures}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.weight_lbs.toLocaleString("en-US")}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                        {r.pieces.toLocaleString("en-US")}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border bg-background/40 font-semibold">
                    <td className="px-4 py-2.5 text-muted-foreground" colSpan={3}>
                      Total
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {report.total_departures}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {report.total_weight_lbs.toLocaleString("en-US")}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-foreground">
                      {report.total_pieces.toLocaleString("en-US")}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {report.rows.length > 0 && (
            // Said once, under the table, because the number in the
            // Total row is smaller than the column above it and that
            // looks like an error until you know why.
            <p className="mt-2 text-xs text-muted-foreground">
              The total departures figure counts flights, not rows — a flight
              carrying two classes on one route appears twice above and once in
              the total.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

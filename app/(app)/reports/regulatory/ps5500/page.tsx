import { ApiError } from "@/lib/api/client";
import { getPS5500Report, type PS5500Report } from "@/lib/api/reports";
import {
  DraftManifestWarning,
  FilingAdvisory,
  FilingEmpty,
  FilingHeader,
  FilingLoadError,
  FilingTable,
  Pct,
  TD,
  TD_MONO,
  TD_NUM,
  TH_CLASS,
} from "@/components/reports/filing-chrome";
import { MonthlyFilingControls } from "@/components/reports/filing-controls";

import { downloadPS5500CsvAction } from "../actions";
import { resolveMonth } from "../period";

/**
 * /reports/regulatory/ps5500 — mail trips by route.
 *
 * Legacy's `reports/ps5500_report.html`. The one column legacy does
 * not have is Cancelled, and it is the reason this page exists in this
 * shape: legacy filters cancelled flights out before counting trips
 * scheduled, so a cancelled trip leaves both sides of the completion
 * ratio. On a form about trips required versus trips performed that is
 * the number that must not flatter.
 */

export const dynamic = "force-dynamic";

export default async function PS5500Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const period = resolveMonth(await searchParams);

  let report: PS5500Report | null = null;
  let loadError: string | null = null;
  try {
    report = period
      ? await getPS5500Report(period.year, period.month)
      : await getPS5500Report();
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
        title="PS Form 5500 — Mail Trips"
        subtitle={
          report
            ? `${report.period_label} · ${report.total_trips_flown} of ${report.total_trips_scheduled} trips flown`
            : undefined
        }
        controls={
          report && (
            <MonthlyFilingControls
              basePath="/reports/regulatory/ps5500"
              filePrefix="ps5500"
              year={report.year}
              month={report.month}
              hasRows={report.rows.length > 0}
              downloadAction={downloadPS5500CsvAction}
            />
          )
        }
      />

      {loadError ? (
        <FilingLoadError message={loadError} />
      ) : report ? (
        <>
          <FilingAdvisory text={report.advisory} />
          <DraftManifestWarning count={report.draft_manifests_excluded} />

          {report.rows.length === 0 ? (
            <FilingEmpty>No trips on file for {report.period_label}.</FilingEmpty>
          ) : (
            <FilingTable caption={`PS Form 5500 for ${report.period_label}`}>
              <thead>
                <tr className={TH_CLASS}>
                  <th scope="col" className="px-4 py-3">
                    Route
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Scheduled
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Flown
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Cancelled
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Completion
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Mail (lbs)
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Pieces
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr
                    key={r.route}
                    className="border-b border-border last:border-0"
                  >
                    <td className={TD_MONO}>{r.route}</td>
                    <td className={TD_NUM}>{r.trips_scheduled}</td>
                    <td className={TD_NUM}>{r.trips_flown}</td>
                    <td className={TD_NUM}>
                      {/* Muted at zero: a column of noticeable zeroes
                          reads as a problem where there isn't one. */}
                      <span
                        className={
                          r.trips_cancelled > 0
                            ? "text-status-yellow"
                            : "text-muted-foreground"
                        }
                      >
                        {r.trips_cancelled}
                      </span>
                    </td>
                    <td className={TD_NUM}>
                      <Pct value={r.completion_pct} />
                    </td>
                    <td className={TD_NUM}>
                      {r.mail_weight_lbs.toLocaleString("en-US")}
                    </td>
                    <td className={TD_NUM}>
                      {r.mail_pieces.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background/40 font-semibold">
                  <td className={`${TD} text-muted-foreground`}>Total</td>
                  <td className={TD_NUM}>{report.total_trips_scheduled}</td>
                  <td className={TD_NUM}>{report.total_trips_flown}</td>
                  <td className={TD_NUM}>{report.total_trips_cancelled}</td>
                  <td className={TD_NUM}>
                    <Pct value={report.total_completion_pct} />
                  </td>
                  <td className={TD_NUM}>
                    {report.total_mail_weight_lbs.toLocaleString("en-US")}
                  </td>
                  <td className={TD_NUM}>
                    {report.total_mail_pieces.toLocaleString("en-US")}
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

import { ApiError } from "@/lib/api/client";
import { getCamReport, type CamReport } from "@/lib/api/reports";
import {
  DraftManifestWarning,
  FilingAdvisory,
  FilingEmpty,
  FilingHeader,
  FilingLoadError,
  FilingTable,
  NotMeasuredNotice,
  Pct,
  TD,
  TD_MONO,
  TD_NUM,
  TH_CLASS,
} from "@/components/reports/filing-chrome";
import { MonthlyFilingControls } from "@/components/reports/filing-controls";

import { downloadCamCsvAction } from "../actions";
import { resolveMonth } from "../period";

/**
 * /reports/regulatory/cam — Contract Air Mail route performance.
 *
 * Legacy's `reports/cam_report.html`, with one column added and one
 * removed, both for the same reason.
 *
 * Added: Not Measured. Legacy counts a completed flight with no
 * arrival data as on time — there is a literal `# assume on-time if no
 * data` in its route loop — so an operator with no tracking scores
 * 100% on the figure a mail contract is judged on. Those flights are
 * counted here and kept out of the percentage, and the notice above
 * the table says how many there were.
 *
 * Removed: Diverted. Legacy's report has the column and its query
 * never fills it, so every CAM report it filed showed zero diversions
 * — indistinguishable from having none. We cannot detect a diversion
 * at all, so the column is absent and the advisory says so. An absent
 * column cannot be misread as a zero.
 *
 * Otherwise the columns are legacy's, in legacy's order. Its header
 * reads "Delayed" where this one reads "Late": the threshold is on
 * arrival against schedule, and "delayed" invites reading it as a late
 * departure, which is a different measurement and not the one a mail
 * contract is scored on.
 */

export const dynamic = "force-dynamic";

export default async function CamPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const period = resolveMonth(await searchParams);

  let report: CamReport | null = null;
  let loadError: string | null = null;
  try {
    report = period
      ? await getCamReport(period.year, period.month)
      : await getCamReport();
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
        title="CAM — Route Performance"
        subtitle={
          report
            ? `${report.period_label} · on time within ${report.on_time_threshold_minutes} minutes of schedule`
            : undefined
        }
        controls={
          report && (
            <MonthlyFilingControls
              basePath="/reports/regulatory/cam"
              filePrefix="cam"
              year={report.year}
              month={report.month}
              hasRows={report.rows.length > 0}
              downloadAction={downloadCamCsvAction}
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

          {report.total_not_measured > 0 && (
            <NotMeasuredNotice>
              {report.total_not_measured} completed flight
              {report.total_not_measured === 1 ? " has" : "s have"} no recorded
              arrival time, so {report.total_not_measured === 1 ? "it" : "they"}{" "}
              could not be assessed and{" "}
              {report.total_not_measured === 1 ? "is" : "are"} excluded from the
              on-time percentage. Record the arrival times before filing if this
              figure matters to the contract.
            </NotMeasuredNotice>
          )}

          {report.rows.length === 0 ? (
            <FilingEmpty>No trips on file for {report.period_label}.</FilingEmpty>
          ) : (
            <FilingTable caption={`CAM performance for ${report.period_label}`}>
              <thead>
                <tr className={TH_CLASS}>
                  <th scope="col" className="px-4 py-3">
                    Route
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Sched
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Compl
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Canc
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    On time
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Late
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Not meas.
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    On time %
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Compl %
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
                    <td className={TD_NUM}>{r.scheduled}</td>
                    <td className={TD_NUM}>{r.completed}</td>
                    <td className={TD_NUM}>
                      <span
                        className={
                          r.cancelled > 0
                            ? "text-status-yellow"
                            : "text-muted-foreground"
                        }
                      >
                        {r.cancelled}
                      </span>
                    </td>
                    <td className={TD_NUM}>{r.on_time}</td>
                    <td className={TD_NUM}>{r.late}</td>
                    <td className={TD_NUM}>
                      {/* The flights legacy would have credited. Worth
                          seeing per route, because tracking tends to
                          fail on particular stations rather than
                          evenly. */}
                      <span
                        className={
                          r.not_measured > 0
                            ? "text-status-yellow"
                            : "text-muted-foreground"
                        }
                      >
                        {r.not_measured}
                      </span>
                    </td>
                    <td className={TD_NUM}>
                      <Pct value={r.on_time_pct} />
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
                  <td className={TD_NUM}>{report.total_scheduled}</td>
                  <td className={TD_NUM}>{report.total_completed}</td>
                  <td className={TD_NUM}>{report.total_cancelled}</td>
                  <td className={TD_NUM}>{report.total_on_time}</td>
                  <td className={TD_NUM}>{report.total_late}</td>
                  <td className={TD_NUM}>{report.total_not_measured}</td>
                  <td className={TD_NUM}>
                    <Pct value={report.total_on_time_pct} />
                  </td>
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

          {report.rows.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              On time % is measured against completed flights with a recorded
              arrival — On time ÷ (On time + Late). Flights under Not measured
              are in neither.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

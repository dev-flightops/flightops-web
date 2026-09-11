import { ApiError } from "@/lib/api/client";
import { getForm5394Report, type Form5394Report } from "@/lib/api/reports";
import {
  DraftManifestWarning,
  FilingAdvisory,
  FilingEmpty,
  FilingHeader,
  FilingLoadError,
  FilingTable,
  TD,
  TD_MONO,
  TD_NUM,
  TH_CLASS,
} from "@/components/reports/filing-chrome";
import { MonthlyFilingControls } from "@/components/reports/filing-controls";

import { downloadForm5394CsvAction } from "../actions";
import { resolveMonth } from "../period";

/**
 * /reports/regulatory/form5394 — per-flight mail records.
 *
 * Legacy's `reports/form5394_report.html`. The only one of the five
 * that is not an aggregate: a row is a flight, and it is the record a
 * USPS audit asks for.
 *
 * Scheduled and actual times are both shown. The form asks what was
 * scheduled and an audit asks what happened; legacy carries the actual
 * arrival and the scheduled departure, which answers one question and
 * guesses at the other.
 */

export const dynamic = "force-dynamic";

/** UTC HH:MM. Times on this form are compared against a schedule, and
 *  a local rendering would shift them by the viewer's offset. */
function hhmm(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(
    d.getUTCMinutes(),
  ).padStart(2, "0")}`;
}

export default async function Form5394Page({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const period = resolveMonth(await searchParams);

  let report: Form5394Report | null = null;
  let loadError: string | null = null;
  try {
    report = period
      ? await getForm5394Report(period.year, period.month)
      : await getForm5394Report();
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 403
        ? "Regulatory filings are limited to executive admins and the director of operations."
        : "Could not load the report just now.";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <FilingHeader
        title="USPS Form 5394 — Mail Transport Records"
        subtitle={
          report
            ? `${report.period_label} · ${report.total_flights} flight${
                report.total_flights === 1 ? "" : "s"
              } carrying mail`
            : undefined
        }
        controls={
          report && (
            <MonthlyFilingControls
              basePath="/reports/regulatory/form5394"
              filePrefix="form5394"
              year={report.year}
              month={report.month}
              hasRows={report.records.length > 0}
              downloadAction={downloadForm5394CsvAction}
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

          {report.records.length === 0 ? (
            <FilingEmpty>
              No mail carried on a locked manifest in {report.period_label}.
            </FilingEmpty>
          ) : (
            <FilingTable caption={`USPS Form 5394 for ${report.period_label}`}>
              <thead>
                <tr className={TH_CLASS}>
                  <th scope="col" className="px-4 py-3">
                    Date
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Flight
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Aircraft
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Route
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Dep sched
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Dep actual
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Arr sched
                  </th>
                  <th scope="col" className="px-4 py-3 text-right">
                    Arr actual
                  </th>
                  <th scope="col" className="px-4 py-3">
                    Mail class
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
                {report.records.map((r) => (
                  <tr
                    key={`${r.flight_number}-${r.scheduled_departure}`}
                    className="border-b border-border last:border-0"
                  >
                    <td className={TD_MONO}>{r.flight_date}</td>
                    <td className={TD_MONO}>{r.flight_number}</td>
                    <td className={TD_MONO}>{r.tail_number}</td>
                    <td className={TD_MONO}>
                      {r.origin}-{r.destination}
                    </td>
                    <td className={`${TD_NUM} font-mono`}>
                      {hhmm(r.scheduled_departure)}
                    </td>
                    <td className={`${TD_NUM} font-mono`}>
                      {hhmm(r.actual_departure)}
                    </td>
                    <td className={`${TD_NUM} font-mono`}>
                      {hhmm(r.scheduled_arrival)}
                    </td>
                    <td className={`${TD_NUM} font-mono`}>
                      {hhmm(r.actual_arrival)}
                    </td>
                    <td className={TD}>{r.mail_class_labels}</td>
                    <td className={TD_NUM}>
                      {r.weight_lbs.toLocaleString("en-US")}
                    </td>
                    <td className={TD_NUM}>
                      {r.pieces.toLocaleString("en-US")}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-background/40 font-semibold">
                  <td className={`${TD} text-muted-foreground`} colSpan={9}>
                    Total
                  </td>
                  <td className={TD_NUM}>
                    {report.total_weight_lbs.toLocaleString("en-US")}
                  </td>
                  <td className={TD_NUM}>
                    {report.total_pieces.toLocaleString("en-US")}
                  </td>
                </tr>
              </tfoot>
            </FilingTable>
          )}

          {report.records.length > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              All times UTC. A dash under an actual time means it was never
              recorded, not that the flight did not operate.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

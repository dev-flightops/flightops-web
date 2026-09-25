import Link from "next/link";

import { ApiError } from "@/lib/api/client";
import {
  getDisclosureCatalogue,
  type DisclosureCatalogue,
  type DisclosureRecord,
} from "@/lib/api/reports";

import { RequestForm } from "./request-form";

/**
 * /compliance/records-request — the 48-hour regulatory disclosure.
 *
 * The operator's GOM commits to producing, within 48 hours of a
 * written request, every document an authorised requestor — the FAA,
 * the NTSB — is entitled to. There was no way to produce a scoped
 * bundle and no way to record having done so.
 *
 * THE FORM IS THE LOG ENTRY
 *
 * Filling it in produces the archive and writes the disclosure record
 * in one act, because the one thing guaranteed about a records request
 * is that somebody will ask about it months after everyone has
 * forgotten the details. Legacy's PRIA export has this shape and one
 * hole in it: its audit call is wrapped in `except Exception: pass`,
 * so a disclosure there can succeed while its trail silently fails.
 *
 * WHAT IS NOT IN A BUNDLE IS ON THIS PAGE
 *
 * Airman records, drug and alcohol testing, training files and
 * airframe logbooks are not produced here, and the reasons are real
 * constraints rather than apologies. Stated before anybody fills the
 * form in, and again on every bundle's cover sheet, because the
 * failure mode of a feature like this is quietly covering what was
 * easy and letting the archive imply it covered everything.
 *
 * THE LOG SHOWS THE INTERVAL, NOT JUST THE ACT
 *
 * Every row carries hours from receipt to production against the
 * commitment. Legacy's PRIARequest stamps one timestamp — the moment
 * the export ran — so its own record cannot answer whether the
 * deadline was met.
 */

export const dynamic = "force-dynamic";

function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function day(iso: string): string {
  return iso.slice(0, 10);
}

function minute(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

function AgencyChip({ agency }: { agency: string }) {
  return (
    <span className="rounded border border-border px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wider text-muted-foreground">
      {agency}
    </span>
  );
}

function LogRow({
  record,
  deadlineHours,
}: {
  record: DisclosureRecord;
  deadlineHours: number;
}) {
  return (
    <li
      data-testid={`disclosure-${record.id}`}
      className="rounded-lg border border-border bg-card px-3 py-2"
    >
      <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
        <span className="font-semibold tabular-nums">
          {day(record.produced_at)}
        </span>
        <AgencyChip agency={record.requestor_agency} />
        <span>{record.requestor_name}</span>
        {record.request_reference && (
          <span className="font-mono text-[0.65rem] text-muted-foreground">
            {record.request_reference}
          </span>
        )}
        {/* The compliance fact, on every row. Green or red rather than
            a number the reader has to compare against 48 themselves. */}
        <span
          className={
            "text-[0.68rem] font-semibold " +
            (record.within_deadline ? "text-status-green" : "text-status-red")
          }
          title={
            record.within_deadline
              ? `Produced ${record.hours_to_produce} hours after receipt, inside the ${deadlineHours}-hour commitment`
              : `Produced ${record.hours_to_produce} hours after receipt, outside the ${deadlineHours}-hour commitment`
          }
        >
          {record.hours_to_produce}h
          {record.within_deadline ? "" : " — late"}
        </span>
      </div>
      <p className="mt-1 text-[0.7rem] text-muted-foreground">
        {day(record.period_start)} to {day(record.period_end)} ·{" "}
        {record.aircraft_tail ?? "entire fleet"} ·{" "}
        {record.categories.length}{" "}
        {record.categories.length === 1 ? "record set" : "record sets"} ·{" "}
        {record.total_records}{" "}
        {record.total_records === 1 ? "row" : "rows"} ·{" "}
        {bytes(record.bundle_bytes)}
      </p>
      <p className="mt-0.5 text-[0.7rem] text-muted-foreground">
        {record.reason}
      </p>
      <p className="mt-1 text-[0.65rem] text-muted-foreground">
        Received {minute(record.request_received_at)} · produced by{" "}
        {record.produced_by_name} ·{" "}
        <span className="font-mono break-all">
          sha256 {record.bundle_sha256}
        </span>
      </p>
    </li>
  );
}

export default async function RecordsRequestPage() {
  let catalogue: DisclosureCatalogue | null = null;
  let loadError: string | null = null;
  try {
    catalogue = await getDisclosureCatalogue();
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `reports-service refused the request (HTTP ${err.status}).`
        : "Could not reach reports-service.";
  }

  if (!catalogue) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">Records Request</h1>
        <div className="mt-4 rounded-xl border border-status-red/40 bg-status-red/5 p-4">
          <p className="text-sm font-semibold text-status-red">
            The disclosure catalogue could not be loaded
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{loadError}</p>
        </div>
      </div>
    );
  }

  const late = catalogue.recent.filter((r) => !r.within_deadline).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <header className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Records Request</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Producing records for an authorised requestor, within the{" "}
          {catalogue.deadline_hours}-hour commitment in the General
          Operations Manual
        </p>
      </header>

      <div className="mb-5 rounded-xl border border-border bg-card p-4">
        <p className="text-xs text-muted-foreground">
          Recording the request and producing the bundle are one action.
          The archive carries a cover sheet naming the requestor, the
          scope, a row count and a SHA-256 for every file, and the log
          below keeps the same details with the hours it took.
        </p>
      </div>

      <section
        aria-label="Produce a bundle"
        className="mb-6 rounded-xl border border-border bg-card p-4"
      >
        <h2 className="mb-3 text-sm font-semibold">
          The written request
        </h2>
        <RequestForm
          categories={catalogue.categories}
          deadlineHours={catalogue.deadline_hours}
        />
      </section>

      <section aria-label="Not produced here" className="mb-6">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Not produced here
        </h2>
        <p className="mb-2 mt-0.5 text-[0.7rem] text-muted-foreground">
          These are named on every bundle&rsquo;s cover sheet too, so
          their absence is not mistaken for their non-existence. A
          requestor who needs one of them has to ask for it separately.
        </p>
        <ul className="rounded-xl border border-border bg-card">
          {catalogue.excluded.map((x) => (
            <li
              key={x.title}
              data-testid={`excluded-${x.title}`}
              className="border-t border-border px-3 py-2.5 first:border-t-0"
            >
              <p className="text-xs font-semibold">{x.title}</p>
              <p className="mt-0.5 text-[0.7rem] leading-relaxed text-muted-foreground">
                {x.reason}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Disclosure log">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-[0.08em] text-muted-foreground">
          Disclosure log
        </h2>
        <p className="mb-2 mt-0.5 text-[0.7rem] text-muted-foreground">
          {catalogue.recent.length === 0 ? (
            <>Nothing has been disclosed from this operator yet.</>
          ) : (
            <>
              Every bundle produced, with the hours from receipt.
              {late > 0 && (
                <span className="text-status-red">
                  {" "}
                  {late} of these {late === 1 ? "was" : "were"} produced
                  outside the {catalogue.deadline_hours}-hour commitment.
                </span>
              )}
            </>
          )}
        </p>
        {catalogue.recent.length > 0 && (
          <ul className="space-y-2">
            {catalogue.recent.map((r) => (
              <LogRow
                key={r.id}
                record={r}
                deadlineHours={catalogue.deadline_hours}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-5 text-[0.7rem] text-muted-foreground">
        A bundle is never truncated. A scope producing more than{" "}
        {catalogue.max_rows.toLocaleString()} rows is refused rather
        than trimmed, because a file that looks complete and is not is
        worse than one that was declined. Related:{" "}
        <Link
          href="/compliance/data-integrity"
          className="text-primary hover:underline"
        >
          Data Integrity Review
        </Link>
        .
      </p>
    </div>
  );
}

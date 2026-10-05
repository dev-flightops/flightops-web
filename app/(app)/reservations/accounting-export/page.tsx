import { getAccountingExport } from "@/lib/api/ops";
import { listCustomers } from "@/lib/api/reservations";
import { ApiError } from "@/lib/api/client";
import type { AccountingExportResponse } from "@/lib/api/types";
import { isValidIsoDay } from "@/lib/iso-day";

import { csvFilename, rowsToCsv } from "./csv";
import { AcctExportFilterBar, type CustomerOption } from "./filter-bar";

/**
 * /reservations/accounting-export — legacy `templates/acct_export/review.html`.
 *
 * Reads live from `/ops/accounting-export?start=&end=&customer=`: every
 * completed flight in the range, with legacy's columns. The CSV is
 * legacy's file (15 columns, its file name, CRLF lines), so the
 * bookkeeper's existing import keeps working (#27).
 *
 * Exec Admins and the Director of Operations only, as in legacy
 * (`modules/acct_export/router.py:33`). The ops service refuses anyone
 * else, and they get the access panel the other finance pages show,
 * with nothing behind it.
 *
 * The range comes from the URL: the filter bar is a GET form. With none
 * it runs from the 1st of this month to today, legacy's default
 * (`router.py:188-192`). Days are UTC, because the export dates each
 * flight by its UTC landing day.
 */

export const dynamic = "force-dynamic";

type Params = {
  start?: string | string[];
  end?: string | string[];
  customer?: string | string[];
};

function parseDate(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return isValidIsoDay(s) ? s : undefined;
}

/** The operator's active customers for the filter, named as the export
 *  names them. Empty when the list can't be read: the page still works,
 *  without the filter. */
async function customerOptions(): Promise<CustomerOption[]> {
  try {
    const { items } = await listCustomers({ limit: 200 });
    return items
      .map((c) => ({
        id: c.id,
        name: c.customer_type === "individual" ? c.full_name : c.company_name || c.full_name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function defaultRange(now: Date = new Date()): { start: string; end: string } {
  const today = now.toISOString().slice(0, 10);
  return { start: `${today.slice(0, 8)}01`, end: today };
}

export default async function AccountingExportPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const fallback = defaultRange();
  const start = parseDate(params.start) ?? fallback.start;
  const end = parseDate(params.end) ?? fallback.end;
  const customerParam = Array.isArray(params.customer) ? params.customer[0] : params.customer;
  const customer = customerParam && /^[0-9a-f-]{36}$/i.test(customerParam) ? customerParam : "";
  const customers = await customerOptions();

  let data: AccountingExportResponse | null = null;
  let forbidden = false;
  let loadError: string | null = null;
  // Asked even when From is after To: the service checks the role
  // first, so whoever it refuses gets the access panel whatever the
  // range, and everyone else gets its 422, said plainly below.
  try {
    data = await getAccountingExport({ start, end, customer: customer || undefined });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    forbidden = status === 403;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : status === 422 && start > end
          ? "The From date is after the To date."
          : "Accounting export unavailable. Try refreshing in a moment.";
  }

  if (forbidden) {
    return (
      <div className="mx-auto max-w-screen-xl px-4 sm:px-6 py-8">
        <header className="mb-6">
          <PageTitle />
        </header>
        <p
          role="alert"
          className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-sm text-status-red"
        >
          The accounting export is limited to executive admins and the
          director of operations.
        </p>
      </div>
    );
  }

  const rows = data?.rows ?? [];

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-6 py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <PageTitle />
        {rows.length > 0 ? (
          <ExportCsvButton rows={rows} filename={csvFilename(start, end)} />
        ) : null}
      </header>

      <AcctExportFilterBar
        key={`${start}:${end}:${customer}`}
        start={start}
        end={end}
        customer={customer}
        customers={customers}
      />

      {loadError ? (
        <div
          role="alert"
          className="mb-5 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : null}

      {/* No tiles or table without data: zeros would read as "nothing
          flew", which nobody knows when the load failed. */}
      {data ? <Activity rows={data.rows} totals={data.totals} /> : null}

      <div className="mt-4 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground/80">About this export:</strong>{" "}
          The CSV contains operational activity only — flight dates, routes,
          customers, passenger counts, and cargo/mail weights. Dollar amounts,
          rates, and billing terms are managed in your accounting software.
          This file can be imported into QuickBooks, Xero, Sage, or any system
          that accepts CSV.
        </p>
      </div>
    </div>
  );
}

function Activity({
  rows,
  totals,
}: {
  rows: AccountingExportResponse["rows"];
  totals: AccountingExportResponse["totals"];
}) {
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile value={totals.flights} label="Completed Flights" color="blue" />
        <StatTile value={totals.revenue_pax} label="Revenue Passengers" />
        <StatTile
          value={`${totals.cargo_lbs.toLocaleString()} lbs`}
          label="Cargo"
        />
        <StatTile
          value={`${totals.mail_lbs.toLocaleString()} lbs`}
          label="Mail (USPS)"
        />
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-8 text-center">
          <p className="text-sm text-muted-foreground">
            No completed flights in this date range.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Adjust the date range or check that flights have been marked as
            landed.
          </p>
        </div>
      ) : (
      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Flight Activity
          </h2>
          <p className="text-xs text-muted-foreground">
            This data is for accounting reference only. No dollar amounts are
            stored in the dispatch platform.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/60 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Date</th>
                <th scope="col" className="px-4 py-2 font-semibold">Flight #</th>
                <th scope="col" className="px-4 py-2 font-semibold">Type</th>
                <th scope="col" className="px-4 py-2 font-semibold">Route</th>
                <th scope="col" className="px-4 py-2 font-semibold">Aircraft</th>
                <th scope="col" className="px-4 py-2 font-semibold">PIC</th>
                <th scope="col" className="px-4 py-2 font-semibold">Customer</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Rev Pax</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Cargo lbs</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Mail lbs</th>
                <th scope="col" className="px-4 py-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-accent">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.date}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-foreground">
                      {r.flight_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.flight_type ? (
                        <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-muted-foreground">
                          {r.flight_type}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">
                      {r.origin} → {r.destination}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.aircraft_tail ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.pic_name ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {r.customer ?? "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                      {r.revenue_pax > 0 ? r.revenue_pax : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                      {r.cargo_lbs > 0 ? r.cargo_lbs.toLocaleString() : "—"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-mono text-xs">
                      {r.mail_lbs && r.mail_lbs > 0
                        ? r.mail_lbs.toLocaleString()
                        : "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-xs text-muted-foreground">
                      {r.notes ?? ""}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </>
  );
}

function ExportCsvButton({
  rows,
  filename,
}: {
  rows: AccountingExportResponse["rows"];
  filename: string;
}) {
  const total = rows.length;
  const icon = (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      className="h-3.5 w-3.5"
      aria-hidden
    >
      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
    </svg>
  );
  if (total === 0) {
    return (
      <span
        aria-disabled
        className="flex cursor-not-allowed items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white opacity-60"
      >
        {icon}
        Export CSV (0 rows)
      </span>
    );
  }
  const csvHref = `data:text/csv;charset=utf-8,${encodeURIComponent(rowsToCsv(rows))}`;
  return (
    <a
      href={csvHref}
      download={filename}
      className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
    >
      {icon}
      Export CSV ({total} rows)
    </a>
  );
}

function PageTitle() {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">Accounting Export</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Review completed flight activity, then export a CSV for your
        accounting software.
      </p>
    </div>
  );
}

function StatTile({
  value,
  label,
  color,
}: {
  value: string | number;
  label: string;
  color?: "blue";
}) {
  const valueCls =
    color === "blue" ? "text-status-blue" : "text-foreground";
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4 text-center">
      <p className={"text-2xl font-bold " + valueCls}>{value}</p>
      <p className="mt-1 text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

import { getAccountingExport } from "@/lib/api/ops";
import { ApiError } from "@/lib/api/client";
import type { AccountingExportResponse } from "@/lib/api/types";

import { AcctExportFilterBar } from "./filter-bar";

/**
 * /reservations/accounting-export — legacy `templates/acct_export/review.html`.
 *
 * Reads live from `/ops/accounting-export?start=&end=` (M2 backend
 * tail). Backend returns every completed flight in the date range
 * with the columns operators need to import into QuickBooks / Xero
 * / Sage. Fields the current schema can't populate come through as
 * null: `customer` (bookings→flight link is not yet modelled) and
 * `mail_lbs` (only total cargo_lbs is tracked). Both render as "—".
 */

export const dynamic = "force-dynamic";

type Params = { start?: string | string[]; end?: string | string[] };

function parseDate(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}

export default async function AccountingExportPage({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const params = await searchParams;
  const start = parseDate(params.start);
  const end = parseDate(params.end);

  let data: AccountingExportResponse | null = null;
  let loadError: string | null = null;
  try {
    data = await getAccountingExport({ start, end });
  } catch (err) {
    const status = err instanceof ApiError ? err.status : 0;
    loadError =
      status === 401
        ? "Your session expired — please sign in again."
        : "Accounting export unavailable. Try refreshing in a moment.";
  }

  const rows = data?.rows ?? [];
  const totals = data?.totals ?? {
    flights: 0,
    revenue_pax: 0,
    cargo_lbs: 0,
    mail_lbs: 0,
  };

  return (
    <div className="mx-auto max-w-screen-xl px-4 py-8">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Accounting Export</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review completed flight activity, then export a CSV for your
            accounting software.
          </p>
        </div>
        <ExportCsvButton rows={rows} />
      </header>

      <AcctExportFilterBar />

      {loadError ? (
        <div
          role="alert"
          className="mb-5 rounded-md border border-status-yellow/40 bg-status-yellow/10 px-3 py-3 text-xs text-status-yellow"
        >
          {loadError}
        </div>
      ) : null}

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

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <h2 className="text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Flight Activity
          </h2>
          <p className="text-xs text-muted-foreground/70">
            This data is for accounting reference only. No dollar amounts are
            stored in the dispatch platform.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/10 text-left text-[0.6875rem] uppercase tracking-[0.06em] text-muted-foreground">
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
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={11}
                    className="px-4 py-16 text-center text-sm text-muted-foreground"
                  >
                    No completed flights in this date range. Adjust the date
                    range or check that flights have been marked as landed.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/5">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted-foreground">
                      {r.date}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-status-blue">
                      {r.flight_number}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-xs">
                      {r.flight_type ? (
                        <span className="rounded border border-border bg-muted/20 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase text-muted-foreground">
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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

function ExportCsvButton({
  rows,
}: {
  rows: AccountingExportResponse["rows"];
}) {
  const total = rows.length;
  const disabled = total === 0;
  const csvHref = disabled
    ? undefined
    : `data:text/csv;charset=utf-8,${encodeURIComponent(rowsToCsv(rows))}`;
  return (
    <a
      href={csvHref ?? "#"}
      download={disabled ? undefined : "accounting-export.csv"}
      aria-disabled={disabled}
      role={disabled ? undefined : "button"}
      onClick={disabled ? (e) => e.preventDefault() : undefined}
      className={
        "flex items-center gap-2 rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100 " +
        (disabled ? "cursor-not-allowed opacity-60" : "hover:brightness-110")
      }
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="h-3.5 w-3.5"
        aria-hidden
      >
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
      </svg>
      Export CSV ({total} rows)
    </a>
  );
}

function rowsToCsv(rows: AccountingExportResponse["rows"]): string {
  const header = [
    "Date",
    "Flight #",
    "Type",
    "Origin",
    "Destination",
    "Aircraft",
    "PIC",
    "Customer",
    "Rev Pax",
    "Cargo lbs",
    "Mail lbs",
    "Notes",
  ].join(",");
  const escape = (v: string | number | null | undefined): string => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((r) =>
    [
      r.date,
      r.flight_number,
      r.flight_type,
      r.origin,
      r.destination,
      r.aircraft_tail,
      r.pic_name,
      r.customer,
      r.revenue_pax,
      r.cargo_lbs,
      r.mail_lbs,
      r.notes,
    ]
      .map(escape)
      .join(","),
  );
  return [header, ...lines].join("\n");
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

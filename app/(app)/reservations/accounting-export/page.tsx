import { AcctExportFilterBar } from "./filter-bar";

/**
 * /reservations/accounting-export — legacy
 * `templates/acct_export/review.html`.
 *
 * Review completed flight activity + export CSV for external
 * accounting software (QuickBooks / Xero / Sage). Sections:
 *   Header: "Accounting Export" + subtitle + right-aligned "Export
 *           CSV (N rows)" download (only when rows > 0)
 *   Filter: From date · To date · Customer dropdown · Filter · Reset
 *   Tiles:  Completed Flights · Revenue Passengers · Cargo lbs ·
 *           Mail (USPS) lbs
 *   Table:  Date · Flight # · Type · Route · Aircraft · PIC ·
 *           Customer · Rev Pax · Cargo lbs · Mail lbs · Notes
 *   Footer: "About this export" info panel explaining dollars are
 *           handled in accounting software, not here
 *
 * No accounting-export backend exists yet. Renders the full shell
 * with disabled Export CSV button until the ops-service exposes the
 * completed-flights aggregate. Legacy's note is preserved verbatim
 * so operators know no dollar amounts are stored here.
 */

const BACKEND_HINT =
  "Accounting Export ships with the ops-service completed-flights aggregate (M2 backend)";

export default function AccountingExportPage() {
  const total = 0;
  const totalFlights = 0;
  const totalPax = 0;
  const totalCargo = 0;
  const totalMail = 0;

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
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={BACKEND_HINT}
          className="flex cursor-not-allowed items-center gap-2 rounded-md bg-status-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-100"
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
        </button>
      </header>

      <AcctExportFilterBar />

      <div className="mb-5 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatTile value={totalFlights} label="Completed Flights" color="blue" />
        <StatTile value={totalPax} label="Revenue Passengers" />
        <StatTile value={`${totalCargo.toLocaleString()} lbs`} label="Cargo" />
        <StatTile value={`${totalMail.toLocaleString()} lbs`} label="Mail (USPS)" />
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
            <tbody>
              <tr>
                <td colSpan={11} className="px-4 py-16 text-center text-sm text-muted-foreground">
                  No completed flights in this date range. Adjust the date range or
                  check that flights have been marked as landed.
                </td>
              </tr>
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

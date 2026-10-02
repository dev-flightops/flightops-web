import type { AccountingExportRow } from "@/lib/api/types";

/**
 * The CSV behind /reservations/accounting-export's Export button.
 *
 * FORMULA-SAFE, UNLIKE LEGACY
 *
 * Legacy (`modules/acct_export/router.py:250-288`) wrote every cell as
 * it was. Notes, names and flight numbers are typed by people, and a
 * spreadsheet runs a cell that starts with `=`, `+`, `-` or `@` as a
 * formula: a note reading `=HYPERLINK(...)` becomes a live link in the
 * accountant's copy. Tab and carriage return are on the same list
 * (OWASP, CSV injection) because some importers split on them and then
 * evaluate what follows. Such a cell gets a leading apostrophe, which
 * Excel, LibreOffice and Google Sheets read as "this is text".
 */
const FORMULA_START = /^[=+\-@\t\r]/;

/** Columns, in order. Legacy has 15; the rest need data the export
 *  does not carry yet (customers, total passengers, cargo descriptions). */
export const CSV_HEADER = [
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
] as const;

/**
 * One CSV field: formula-safe first, then quoted when it holds a quote,
 * comma or line break (RFC 4180).
 *
 * Numbers are written as they are. The counts and weights arrive from
 * the API as numbers, which cannot carry a formula, and an apostrophe
 * on a negative one would turn it into text in the accounting package.
 */
export function csvCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return String(v);
  const safe = FORMULA_START.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function rowsToCsv(rows: readonly AccountingExportRow[]): string {
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
      .map(csvCell)
      .join(","),
  );
  return [CSV_HEADER.join(","), ...lines].join("\n");
}

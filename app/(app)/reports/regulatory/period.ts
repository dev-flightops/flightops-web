/**
 * Reading a filing period off the query string.
 *
 * Both or neither, matching the service. Passing half a period would
 * have it fill in the other half from today and report a period nobody
 * asked for — which on a page whose output gets filed is worse than
 * ignoring the parameter.
 */

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{1,2}$/;
const QUARTER_RE = /^[1-4]$/;

export function resolveMonth(params: {
  year?: string;
  month?: string;
}): { year: number; month: number } | null {
  const { year, month } = params;
  if (year === undefined || month === undefined) return null;
  if (!YEAR_RE.test(year) || !MONTH_RE.test(month)) return null;
  const m = Number(month);
  if (m < 1 || m > 12) return null;
  return { year: Number(year), month: m };
}

export function resolveQuarter(params: {
  year?: string;
  quarter?: string;
}): { year: number; quarter: number } | null {
  const { year, quarter } = params;
  if (year === undefined || quarter === undefined) return null;
  if (!YEAR_RE.test(year) || !QUARTER_RE.test(quarter)) return null;
  return { year: Number(year), quarter: Number(quarter) };
}

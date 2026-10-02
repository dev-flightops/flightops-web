/**
 * The three invoicing settings, between the form and auth-service.
 *
 * auth-service stores the cargo rate as dollars per lb to four decimals
 * and the tax rate as a fraction ("0.07500"); the form shows the tax as
 * a percentage (7.5). The conversions work on the decimal strings, not
 * on floats: 7.5 / 100 in floating point is 0.075000000000000011, and
 * that would be refused for its decimals or, worse, stored nearly
 * right.
 *
 * Each parser returns the value to send, `null` for a blank field
 * (which clears the setting), or `undefined` for input it cannot
 * accept.
 */

/** Dollars per lb: up to six whole digits and four decimals, the
 *  column's Numeric(10, 4). "0.475" -> "0.4750". */
export function parseCargoRate(input: string): string | null | undefined {
  const value = input.trim();
  if (value === "") return null;
  const m = /^(\d{1,6})(?:\.(\d{0,4}))?$/.exec(value);
  if (!m) return undefined;
  const whole = String(Number(m[1]));
  return `${whole}.${(m[2] ?? "").padEnd(4, "0")}`;
}

/** A percentage from 0 to 100 with up to three decimals, to the
 *  fraction the service stores (five decimals). "7.5" -> "0.07500". */
export function parseTaxPercent(input: string): string | null | undefined {
  const value = input.trim();
  if (value === "") return null;
  const m = /^(\d{1,3})(?:\.(\d{0,3}))?$/.exec(value);
  if (!m) return undefined;
  // Thousandths of a percent, which are hundred-thousandths of the
  // fraction: an integer all the way, so nothing is rounded.
  const thousandths = Number(m[1]) * 1000 + Number((m[2] ?? "").padEnd(3, "0"));
  if (thousandths > 100_000) return undefined;
  const whole = Math.floor(thousandths / 100_000);
  const frac = String(thousandths % 100_000).padStart(5, "0");
  return `${whole}.${frac}`;
}

/** The stored fraction as the percentage the form shows, trailing zeros
 *  dropped: "0.07500" -> "7.5", "1.00000" -> "100", null -> "". */
export function taxPercentFromFraction(fraction: string | null): string {
  if (fraction == null || fraction === "") return "";
  const m = /^(\d+)(?:\.(\d*))?$/.exec(fraction.trim());
  if (!m) return "";
  // Hundred-thousandths of the fraction are thousandths of a percent.
  const units =
    Number(m[1]) * 100_000 + Number((m[2] ?? "").slice(0, 5).padEnd(5, "0"));
  const whole = Math.floor(units / 1000);
  const decimals = String(units % 1000).padStart(3, "0").replace(/0+$/, "");
  return decimals ? `${whole}.${decimals}` : String(whole);
}

/** Whole days from 0 to 365. */
export function parseTermsDays(input: string): number | null | undefined {
  const value = input.trim();
  if (value === "") return null;
  if (!/^\d{1,3}$/.test(value)) return undefined;
  const days = Number(value);
  return days <= 365 ? days : undefined;
}

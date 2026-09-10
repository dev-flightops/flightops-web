/**
 * Money and quantity display, shared by the list and the detail.
 *
 * In one place so the two screens cannot disagree, and matching the
 * PDF's formatting (`services/billing/app/customer_invoicing/pdf.py`)
 * — the same invoice read on screen and on paper should show the same
 * string.
 */

/** Cents to a displayed amount. Negatives are parenthesised rather
 *  than signed: an accountant reads (12.50) faster than -12.50, and a
 *  leading minus in a right-aligned column is easy to miss. */
export function money(cents: number): string {
  const whole = Math.trunc(Math.abs(cents) / 100);
  const frac = Math.abs(cents) % 100;
  const text = `${whole.toLocaleString("en-US")}.${String(frac).padStart(2, "0")}`;
  return cents < 0 ? `(${text})` : text;
}

/** Thousandths to a readable quantity — one passenger reads "1", not
 *  "1.000", while 137.5 lbs of cargo keeps its half. */
export function quantity(milli: number): string {
  const text = (milli / 1000).toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
  return text || "0";
}

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  void: "Void",
};

/** Palette per status. `void` is grey rather than red — a voided
 *  invoice is a closed matter, not a problem to act on, and red would
 *  put it in the same visual class as an overdue one. */
export function statusClasses(status: string): string {
  if (status === "paid") return "bg-status-green/15 text-status-green";
  if (status === "sent") return "bg-status-blue/15 text-status-blue";
  if (status === "draft") return "bg-status-yellow/15 text-status-yellow";
  return "bg-muted/40 text-muted-foreground";
}

/** True when a sent invoice is past its due date. Compared as calendar
 *  dates in UTC, not as instants — an invoice due today is not overdue
 *  at 00:01 in a zone ahead of the operator. */
export function isOverdue(
  status: string,
  dueDate: string | null,
  today: string,
): boolean {
  if (status !== "sent" || !dueDate) return false;
  return dueDate < today;
}

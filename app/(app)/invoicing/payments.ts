/**
 * Payment methods and amounts, shared by the record-payment form, the
 * mark-paid panel and the payment history on the invoice page.
 */

import type { PaymentMethod } from "@/lib/api/customer-invoices";

/** What the form offers: every method the service records. `account`
 *  (on-account) and `comp` are not money received (#127), so neither
 *  is offered or accepted. */
export const FORM_METHODS: ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}> = [
  { value: "cash", label: "Cash" },
  { value: "check", label: "Check" },
  { value: "card", label: "Card" },
  { value: "transfer", label: "ACH or wire" },
  { value: "other", label: "Other" },
];

/** Every method a payment can carry, for the history. Includes the two
 *  no longer recorded, for any payment entered before (#127). */
export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  check: "Check",
  card: "Card",
  transfer: "ACH or wire",
  other: "Other",
  account: "On account",
  comp: "Comp",
  credit: "Credit note",
};

/** Above this a refund names who approved it (#127): the client's
 *  figure, and the old system's default. billing-service's
 *  APPROVAL_OVER_CENTS. */
export const REFUND_APPROVAL_OVER_CENTS = 500_00;

export function isFormMethod(value: string): value is PaymentMethod {
  return FORM_METHODS.some((m) => m.value === value);
}

/** A typed amount to cents, or null when it is not an amount. Accepts
 *  "250", "250.5", "250.50", "1,250.00" and a leading "$". Commas only
 *  as thousands separators: "1,00" is not read as one dollar. */
export function parseAmount(text: string): number | null {
  const t = text.trim().replace(/^\$\s*/, "");
  if (!/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{1,2})?$/.test(t)) return null;
  const [whole, frac = ""] = t.replace(/,/g, "").split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Cents as an input's value: "600.00", no grouping, so it parses back
 *  to the same number. */
export function centsToInput(cents: number): string {
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Today's date where the person is, as YYYY-MM-DD. The service refuses
 *  a payment dated after its own today (UTC), and west of Greenwich the
 *  local date is never later than that, while defaulting to the UTC
 *  date would date an evening's cheque tomorrow. */
export function todayLocalIsoDate(now: Date = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

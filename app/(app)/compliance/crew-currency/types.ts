import type { CurrencyStatus } from "@/lib/api/types";

export type { CurrencyStatus };

/** Type guard for `?status=` URL params — keeps any garbled value
 *  from leaking into the API call. */
export function isCurrencyStatus(value: string | undefined): value is CurrencyStatus {
  return (
    value === "not_started" ||
    value === "upcoming" ||
    value === "early_month" ||
    value === "due_this_month" ||
    value === "grace_month" ||
    value === "non_current"
  );
}

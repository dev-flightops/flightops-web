import { type CharterStatus } from "@/lib/api/charter";

/**
 * Customer-facing status wording.
 *
 * Deliberately NOT reusing CHARTER_STATUS_LABELS from the api module.
 * Two reasons: importing a runtime value from there drags the
 * next-auth -> next/server chain into any unit test of this file (the
 * same trap release-errors.ts documents), and the words a customer
 * should read are a presentation choice that may diverge from internal
 * pipeline vocabulary. The type import above is erased at compile time,
 * so the status set still cannot drift from the backend's.
 */
const PORTAL_STATUS_LABELS: Record<CharterStatus, string> = {
  request: "Requested",
  quoted: "Quoted",
  confirmed: "Confirmed",
  dispatched: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

/**
 * Shared portal presentation bits.
 *
 * Kept out of the page modules so the detail page can reuse them:
 * importing from a `page.tsx` works but couples two routes through a
 * module Next.js treats specially, and it breaks the moment either page
 * gains a directive the other shouldn't inherit.
 */

/** Statuses a customer sees. Colours follow legacy: confirmed and
 *  dispatched read as in-progress (yellow), completed as done (green),
 *  cancelled as red, everything earlier as neutral. */
export function StatusBadge({ status }: { status: CharterStatus }) {
  const tone =
    status === "completed"
      ? "bg-status-green/15 text-status-green"
      : status === "confirmed" || status === "dispatched"
        ? "bg-status-yellow/15 text-status-yellow"
        : status === "cancelled"
          ? "bg-status-red/15 text-status-red"
          : "bg-muted/40 text-muted-foreground";
  return (
    <span
      className={`inline-flex rounded px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.06em] ${tone}`}
    >
      {PORTAL_STATUS_LABELS[status] ?? status}
    </span>
  );
}

/**
 * "2026-08-20" → "Aug 20, 2026", matching legacy's strftime("%b %d, %Y").
 *
 * Parsed as a plain calendar date rather than a timestamp. `new
 * Date("2026-08-20")` is UTC midnight, which renders as the 19th
 * anywhere west of Greenwich — including every station this operator
 * flies to. A customer seeing yesterday's date on their own booking is
 * the kind of small wrongness that costs trust.
 */
export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

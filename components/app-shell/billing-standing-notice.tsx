import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import { Notice } from "@/components/ff/notice";
import type { BillingStanding } from "@/lib/api/billing";
import { DEFAULT_TIME_ZONE, localDateTime } from "@/lib/format/local-time";

/**
 * The company's subscription when it isn't paid up (#127). The client's
 * decision: a failed renewal payment shows a warning, then 14 days'
 * grace, then read-only access until it's paid, with nothing deleted.
 * Every staff page shows it, since read-only reaches every login; the
 * people who manage the subscription get the way to pay.
 *
 * The sentences are template literals: a server render dropped the
 * space after an expression in text that held an entity.
 */
export function BillingStandingNotice({
  standing,
  canPay,
}: {
  standing: BillingStanding | null;
  canPay: boolean;
}) {
  if (!standing || standing.state === "ok" || !standing.read_only_from) {
    return null;
  }
  const action = canPay ? (
    <Link href="/settings/billing" className={`${linkCaps} whitespace-nowrap`}>
      Pay in Settings › Billing <span aria-hidden>›</span>
    </Link>
  ) : (
    "An Exec Admin or the Director of Operations can pay it in Settings › Billing."
  );

  if (standing.state === "grace") {
    const until = localDateTime(standing.read_only_from, DEFAULT_TIME_ZONE);
    return (
      <Notice tone="yellow" label="Payment failed" role="status">
        {`The company’s subscription payment didn’t go through. If it isn’t paid by ${until}, nothing can be changed from then until it is. Flight following, safety reports and clocking out will keep working.`}{" "}
        {action}
      </Notice>
    );
  }
  return (
    <Notice tone="red" label="Read-only">
      {"The company’s subscription payment is overdue, so nothing can be changed until it’s paid. Nothing has been deleted. Flight following, safety reports and clocking out keep working."}{" "}
      {action}
    </Notice>
  );
}

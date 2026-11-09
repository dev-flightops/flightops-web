import Link from "next/link";

import { linkCaps } from "@/components/ff/controls";
import type { HandoffItem } from "@/lib/api/types";
import { handoffLine } from "@/lib/flights/handoff-text";
import { cn } from "@/lib/utils";

/**
 * Home's Waiting on you list (#175): what the flow waits on this person
 * for, as the bell says it. Presentational, so a test renders it without
 * the fetch (see alerts-list.tsx for why).
 */
export function WaitingOnYouList({ items }: { items: HandoffItem[] | null }) {
  return (
    <section aria-labelledby="waiting-on-you" className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-3">
        <h2 id="waiting-on-you" className="panel-title">
          Waiting on you
        </h2>
        {items && items.length > 0 ? <span className="eyebrow">{items.length} to do</span> : null}
      </header>
      {items === null ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">
          Couldn&apos;t check what&apos;s waiting on you. Refresh in a moment.
        </p>
      ) : items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-muted-foreground">Nothing is waiting on you.</p>
      ) : (
        <ul className="divide-y divide-border">
          {items.map((item) => {
            const line = handoffLine(item);
            return (
              <li
                key={`${item.kind}-${item.turn}-${item.flight_id}`}
                className={cn(
                  "flex flex-wrap items-start justify-between gap-3 border-l-[3px] px-5 py-3",
                  line.severity === "red" ? "border-l-status-red" : "border-l-status-yellow",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">{line.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{line.detail}</p>
                </div>
                <Link href={line.href} className={cn(linkCaps, "shrink-0")}>
                  Open ›
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

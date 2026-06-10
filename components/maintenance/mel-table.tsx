import Link from "next/link";

import { cn } from "@/lib/utils";
import type { MelItemResponse } from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * MEL items list — used in two contexts:
 *   - Per-aircraft (M2-G-20): aircraft column omitted, scope implied.
 *   - Cross-fleet (M2-G-21): aircraft column shown so dispatchers can
 *     see at a glance which tail owns the row + click through to its
 *     detail page.
 *
 * `Due` column tints red when the deferral has already lapsed and
 * yellow when it lapses inside 7 days — same urgency window the
 * dispatch panel's airworthiness verdict uses.
 *
 * Closed rows fade the Due cell to muted regardless of date so they
 * read as historical, not pending action. The caller decides whether
 * to include closed items via the backend `status=` filter.
 *
 * Close / defer-extension actions live on the dispatch maintenance
 * panel for now; M2-G-20b can inline them once decoupled from
 * dispatch.
 */
export function MelTable({
  items,
  showAircraft = false,
  emptyMessage = "No open MEL items.",
}: {
  items: MelItemResponse[];
  showAircraft?: boolean;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const now = Date.now();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {showAircraft && <th className="px-3 py-2">Aircraft</th>}
            <th className="px-3 py-2">ATA</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Deferred</th>
            <th className="px-3 py-2">Due</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MelRow
              key={item.id}
              item={item}
              now={now}
              showAircraft={showAircraft}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MelRow({
  item,
  now,
  showAircraft,
}: {
  item: MelItemResponse;
  now: number;
  showAircraft: boolean;
}) {
  const dueAt = new Date(item.due_at).getTime();
  const daysToDue = (dueAt - now) / (1000 * 60 * 60 * 24);
  // Closed items render the Due column in the muted tone — historical,
  // not pending action — regardless of date.
  const isClosed = item.status === "closed";
  const dueTone: "red" | "yellow" | "muted" = isClosed
    ? "muted"
    : daysToDue < 0
      ? "red"
      : daysToDue < 7
        ? "yellow"
        : "muted";
  const deferred = formatBoth(item.deferred_at);
  const due = formatBoth(item.due_at);

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      {showAircraft && (
        <td className="px-3 py-2.5">
          <Link
            href={`/maintenance/aircraft/${item.aircraft.id}`}
            className="font-mono font-semibold text-status-blue hover:underline"
          >
            {item.aircraft.tail_number}
          </Link>
          <div className="text-[0.6rem] text-muted-foreground">
            {item.aircraft.model}
          </div>
        </td>
      )}
      <td className="px-3 py-2.5 font-mono text-foreground">
        {item.ata_chapter}
      </td>
      <td className="px-3 py-2.5 text-foreground">{item.description}</td>
      <td className="px-3 py-2.5 font-mono text-muted-foreground">
        {item.category}
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{deferred.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">{deferred.zulu}</div>
      </td>
      <td className={cn("px-3 py-2.5", toneClass(dueTone))}>
        <div className="font-mono">{due.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">
          {due.zulu}{" "}
          {!isClosed && daysToDue < 0 ? (
            <span className="font-semibold">
              · {Math.abs(Math.floor(daysToDue))}d overdue
            </span>
          ) : !isClosed && daysToDue < 7 ? (
            <span className="font-semibold">
              · {Math.floor(daysToDue)}d left
            </span>
          ) : null}
        </div>
      </td>
      <td className="px-3 py-2.5">
        <span
          className={cn(
            "inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em]",
            isClosed
              ? "bg-muted/40 text-muted-foreground"
              : "bg-status-yellow/15 text-status-yellow",
          )}
        >
          {isClosed ? "Closed" : "Open"}
        </span>
      </td>
    </tr>
  );
}

function toneClass(tone: "red" | "yellow" | "muted"): string {
  switch (tone) {
    case "red":
      return "text-status-red";
    case "yellow":
      return "text-status-yellow";
    case "muted":
      return "text-muted-foreground";
  }
}

import { cn } from "@/lib/utils";
import type { MelItemResponse } from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * Open-MEL list rendered on the aircraft detail page (M2-G-20). Closed
 * MELs are filtered out by the caller — the page asks the backend for
 * `status=open` only.
 *
 * Each row's `Due` column is tinted red when the deferral has already
 * lapsed and yellow when it lapses inside 7 days — same urgency window
 * the dispatch panel's airworthiness verdict uses. Rows otherwise stay
 * muted.
 *
 * Close/Defer-extension actions live on the dispatch maintenance panel
 * for now; M2-G-20b can inline them here once we extract the dialogs
 * from `components/dispatch/packet/`.
 */
export function MelTable({ items }: { items: MelItemResponse[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
        No open MEL items.
      </div>
    );
  }

  const now = Date.now();
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">ATA</th>
            <th className="px-3 py-2">Description</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Deferred</th>
            <th className="px-3 py-2">Due</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <MelRow key={item.id} item={item} now={now} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MelRow({ item, now }: { item: MelItemResponse; now: number }) {
  const dueAt = new Date(item.due_at).getTime();
  const daysToDue = (dueAt - now) / (1000 * 60 * 60 * 24);
  const dueTone =
    daysToDue < 0 ? "red" : daysToDue < 7 ? "yellow" : "muted";
  const deferred = formatBoth(item.deferred_at);
  const due = formatBoth(item.due_at);

  return (
    <tr className="border-t border-border hover:bg-muted/20">
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
          {daysToDue < 0 ? (
            <span className="font-semibold">
              · {Math.abs(Math.floor(daysToDue))}d overdue
            </span>
          ) : daysToDue < 7 ? (
            <span className="font-semibold">
              · {Math.floor(daysToDue)}d left
            </span>
          ) : null}
        </div>
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

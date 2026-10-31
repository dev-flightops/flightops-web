import Link from "next/link";

import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
import { DUE_ITEM_KINDS, type DueItem, type DueState } from "@/lib/api/maintenance";
import { formatZuluDate } from "@/lib/format/flight-time";

import { RetireDueItemButton, SignOffDueItemDialog } from "./due-item-dialogs";

/**
 * The maintenance due list (#156): each item, when it comes due by hours
 * and by date, and how far off that is, most urgent first. The client,
 * 10/29: "Overdue inspections don't ground aircraft ... those aircraft
 * show 'All items current / Airworthy' and keep flying." An overdue item
 * that grounds says so here, as the fleet card and the release do.
 */
const STATE: Record<DueState, { label: string; tone: StatusTone }> = {
  overdue: { label: "Overdue", tone: "red" },
  due_soon: { label: "Due soon", tone: "yellow" },
  current: { label: "Current", tone: "green" },
  not_scheduled: { label: "Not scheduled", tone: "muted" },
};

const KIND = Object.fromEntries(DUE_ITEM_KINDS.map((k) => [k.value, k.label]));

function hours(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** "7.5 h over", "12 h left"; "74 d over", "due today". */
function left(item: DueItem): string[] {
  const parts: string[] = [];
  if (item.hours_left !== null) {
    parts.push(item.hours_left <= 0 ? `${hours(-item.hours_left)} h over` : `${hours(item.hours_left)} h left`);
  }
  if (item.days_left !== null) {
    parts.push(
      item.days_left < 0
        ? `${-item.days_left} d over`
        : item.days_left === 0
          ? "due today"
          : `${item.days_left} d left`,
    );
  }
  return parts;
}

export function DueListTable({
  items,
  showAircraft = false,
  canSignOff = false,
  emptyMessage = "Nothing on the due list.",
}: {
  items: DueItem[];
  showAircraft?: boolean;
  /** The viewer may sign items off and retire them (AIRWORTHINESS_WRITERS). */
  canSignOff?: boolean;
  emptyMessage?: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card px-5 py-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="ff-thead">
          <tr className="text-left eyebrow">
            {showAircraft && <th className="px-3 py-2">Aircraft</th>}
            <th className="px-3 py-2">Item</th>
            <th className="px-3 py-2">Due at</th>
            <th className="px-3 py-2">Left</th>
            <th className="px-3 py-2">Last done</th>
            <th className="px-3 py-2">Status</th>
            {canSignOff && (
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const state = STATE[item.state];
            const overdue = item.state === "overdue";
            return (
              <tr
                key={item.id}
                className={
                  overdue
                    ? "border-t border-border shadow-[inset_3px_0_0_rgb(var(--status-red))] hover:bg-accent"
                    : "border-t border-border hover:bg-accent"
                }
              >
                {showAircraft && (
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/maintenance/aircraft/${item.aircraft_id}`}
                      className="font-mono font-semibold text-primary hover:underline"
                    >
                      {item.tail_number}
                    </Link>
                  </td>
                )}
                <td className="px-3 py-2.5 text-foreground">
                  <div className="font-semibold">{item.title}</div>
                  <div className="text-[0.65rem] text-muted-foreground">
                    {[KIND[item.kind], item.reference, every(item)].filter(Boolean).join(" · ")}
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono tabular-nums text-foreground">
                  {item.due_hours !== null && <div>{hours(item.due_hours)} h</div>}
                  {item.due_on && <div>{formatZuluDate(item.due_on)}</div>}
                  {item.due_hours === null && !item.due_on && <span className="text-muted-foreground">—</span>}
                </td>
                <td className={overdue ? "px-3 py-2.5 font-mono font-semibold text-status-red" : "px-3 py-2.5 font-mono text-muted-foreground"}>
                  {left(item).map((part) => (
                    <div key={part}>{part}</div>
                  ))}
                </td>
                <td className="px-3 py-2.5 font-mono text-muted-foreground">
                  {item.last_done_on ? formatZuluDate(item.last_done_on) : "—"}
                  {item.last_done_hours !== null && <div>{hours(item.last_done_hours)} h</div>}
                </td>
                <td className="px-3 py-2.5">
                  <StatusMark label={state.label} tone={state.tone} />
                  {overdue && item.grounds_when_overdue && (
                    <div className="mt-0.5 text-[0.65rem] font-semibold text-status-red">Grounds the aircraft</div>
                  )}
                </td>
                {canSignOff && (
                  <td className="whitespace-nowrap px-3 py-2.5 text-right">
                    <SignOffDueItemDialog item={item} />
                    <RetireDueItemButton item={item} />
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** "every 100 h / 12 mo"; nothing for a one-off. */
function every(item: DueItem): string | null {
  const parts: string[] = [];
  if (item.interval_hours) parts.push(`${hours(item.interval_hours)} h`);
  if (item.interval_days) {
    parts.push(item.interval_days % 365 === 0 ? `${item.interval_days / 365} yr` : `${item.interval_days} d`);
  }
  return parts.length ? `every ${parts.join(" / ")}` : null;
}

import Link from "next/link";

import { ResolveSquawkDialog } from "@/components/dispatch/packet/resolve-squawk-dialog";
import { cn } from "@/lib/utils";
import type { SquawkResponse, SquawkSeverity } from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * Squawks list — used in two contexts:
 *   - Per-aircraft (M2-G-20): aircraft column omitted, scope implied.
 *   - Cross-fleet (M2-G-21): aircraft column shown with click-through
 *     to the aircraft detail page.
 *
 * Severity pill colors match the dispatch maintenance panel:
 *   grounding → red (always dispatch-blocking)
 *   major     → yellow (advisory)
 *   minor     → muted (cosmetic; backend already drops these from the
 *               airworthiness verdict so they only surface in lists)
 *
 * `canResolve` adds Resolve for maintenance (AIRWORTHINESS_WRITERS,
 * 29 Sep): resolving returns the aircraft to service, and the dispatch
 * packet no longer offers it to anyone else.
 */
export function SquawksTable({
  items,
  showAircraft = false,
  emptyMessage = "No open squawks.",
  canResolve = false,
}: {
  items: SquawkResponse[];
  showAircraft?: boolean;
  emptyMessage?: string;
  /** The viewer may resolve squawks (AIRWORTHINESS_WRITERS). */
  canResolve?: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/60">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {showAircraft && <th className="px-3 py-2">Aircraft</th>}
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Reported</th>
            <th className="px-3 py-2">By</th>
            <th className="px-3 py-2">Status</th>
            {canResolve && (
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {items.map((sq) => (
            <SquawkRow
              key={sq.id}
              squawk={sq}
              showAircraft={showAircraft}
              canResolve={canResolve}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SquawkRow({
  squawk,
  showAircraft,
  canResolve,
}: {
  squawk: SquawkResponse;
  showAircraft: boolean;
  canResolve: boolean;
}) {
  const reported = formatBoth(squawk.reported_at);

  return (
    <tr className="border-t border-border hover:bg-accent">
      {showAircraft && (
        <td className="px-3 py-2.5">
          <Link
            href={`/maintenance/aircraft/${squawk.aircraft.id}`}
            className="font-mono font-semibold text-primary hover:underline"
          >
            {squawk.aircraft.tail_number}
          </Link>
          <div className="text-[0.6rem] text-muted-foreground">
            {squawk.aircraft.model}
          </div>
        </td>
      )}
      <td className="px-3 py-2.5 text-foreground">
        <div>{squawk.title}</div>
        {squawk.description && squawk.description !== squawk.title && (
          <div className="mt-0.5 text-[0.65rem] text-muted-foreground line-clamp-2">
            {squawk.description}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5">
        <SeverityPill severity={squawk.severity} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{reported.local}</div>
        <div className="font-mono text-[0.6rem]">{reported.zulu}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {squawk.reported_by.full_name}
      </td>
      <td className="px-3 py-2.5">
        <StatusChip status={squawk.status} />
      </td>
      {canResolve && (
        <td className="px-3 py-2.5 text-right">
          {squawk.status !== "resolved" && (
            <ResolveSquawkDialog
              squawkId={squawk.id}
              title={squawk.title}
              severity={squawk.severity}
            />
          )}
        </td>
      )}
    </tr>
  );
}

function SeverityPill({ severity }: { severity: SquawkSeverity }) {
  const config: Record<SquawkSeverity, { label: string; className: string }> = {
    grounding: {
      label: "Grounding",
      className: "bg-status-red/15 text-status-red",
    },
    major: {
      label: "Major",
      className: "bg-status-yellow/15 text-status-yellow",
    },
    minor: {
      label: "Minor",
      className: "bg-muted text-muted-foreground",
    },
  };
  const c = config[severity];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[0.6rem] font-semibold uppercase tracking-[0.08em]",
        c.className,
      )}
    >
      {c.label}
    </span>
  );
}

function StatusChip({ status }: { status: SquawkResponse["status"] }) {
  const label =
    status === "in_progress" ? "In progress" : status === "open" ? "Open" : "Resolved";
  return (
    <span className="inline-flex items-center rounded bg-muted px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}
    </span>
  );
}

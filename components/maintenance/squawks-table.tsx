import { cn } from "@/lib/utils";
import type { SquawkResponse, SquawkSeverity } from "@/lib/api/types";
import { formatBoth } from "@/lib/format/flight-time";

/**
 * Open-squawk list rendered on the aircraft detail page (M2-G-20).
 * Resolved squawks are filtered out by the caller — the page asks the
 * backend for `status=open` and `status=in_progress` only.
 *
 * Severity pill colors match the dispatch maintenance panel:
 *   grounding → red (always dispatch-blocking)
 *   major     → yellow (advisory)
 *   minor     → muted (cosmetic; backend already drops these from the
 *               airworthiness verdict so they only surface in lists)
 */
export function SquawksTable({ items }: { items: SquawkResponse[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border bg-card/40 px-4 py-8 text-center text-xs text-muted-foreground">
        No open squawks.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card">
      <table className="w-full text-xs">
        <thead className="bg-muted/30">
          <tr className="text-left text-[0.6rem] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Title</th>
            <th className="px-3 py-2">Severity</th>
            <th className="px-3 py-2">Reported</th>
            <th className="px-3 py-2">By</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((sq) => (
            <SquawkRow key={sq.id} squawk={sq} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SquawkRow({ squawk }: { squawk: SquawkResponse }) {
  const reported = formatBoth(squawk.reported_at);

  return (
    <tr className="border-t border-border hover:bg-muted/20">
      <td className="px-3 py-2.5 text-foreground">{squawk.title}</td>
      <td className="px-3 py-2.5">
        <SeverityPill severity={squawk.severity} />
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        <div className="font-mono">{reported.local}</div>
        <div className="font-mono text-[0.6rem] opacity-80">{reported.zulu}</div>
      </td>
      <td className="px-3 py-2.5 text-muted-foreground">
        {squawk.reported_by.full_name}
      </td>
      <td className="px-3 py-2.5">
        <StatusChip status={squawk.status} />
      </td>
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
      className: "bg-muted/40 text-muted-foreground",
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
    <span className="inline-flex items-center rounded bg-muted/30 px-1.5 py-0.5 font-mono text-[0.6rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      {label}
    </span>
  );
}

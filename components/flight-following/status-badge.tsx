import { cn } from "@/lib/utils";
import type { FlightStatus } from "@/lib/api/types";

/**
 * Status pill rendered in the board's STATUS column. Maps the ops
 * service's four canonical statuses to the legacy board labels:
 *
 *   scheduled  → PLANNED   (blue tint)
 *   released   → AIRBORNE  (green tint)
 *   cancelled  → CANCELLED (grey, faded)
 *   completed  → LANDED    (grey)
 *
 * Wider status set (on_ground / delayed / diverted) lives in
 * M2-M-14b — handled there by extending FlightStatus on the
 * backend. The "OVERDUE" pill is rendered alongside AIRBORNE by
 * the board row, not by this component.
 */
export function StatusBadge({ status }: { status: FlightStatus }) {
  const config = STATUS_LABELS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em]",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

/** Red pill rendered next to AIRBORNE when the flight is past
 *  scheduled_arrival_at + 30 min. Kept as its own component so the
 *  legacy two-pill layout (`AIRBORNE  OVERDUE`) is easy to compose. */
export function OverdueBadge() {
  return (
    <span className="inline-flex items-center rounded bg-status-red/15 px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-[0.08em] text-status-red">
      Overdue
    </span>
  );
}

const STATUS_LABELS: Record<
  FlightStatus,
  { label: string; className: string }
> = {
  scheduled: {
    label: "Planned",
    className: "bg-status-blue/15 text-status-blue",
  },
  released: {
    label: "Airborne",
    className: "bg-status-green/15 text-status-green",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-muted/40 text-muted-foreground opacity-60",
  },
  completed: {
    label: "Landed",
    className: "bg-muted/40 text-muted-foreground",
  },
};

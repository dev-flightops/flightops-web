import { cn } from "@/lib/utils";
import type { FlightStatus } from "@/lib/api/types";

/**
 * Status pill rendered in the board's STATUS column. Maps the ops
 * service's four canonical statuses to the legacy board labels:
 *
 *   scheduled  → PLANNED   (blue tint)
 *   released   → RELEASED  (yellow) when actual_departure_at IS NULL
 *   released   → AIRBORNE  (green tint) when actual_departure_at set
 *   cancelled  → CANCELLED (grey, faded)
 *   completed  → LANDED    (grey)
 *
 * The `released` status covers two operational states — packet
 * released but wheels still on the ground vs. actually airborne.
 * Splitting the pill by `actual_departure_at` keeps the row in
 * sync with the summary-stats-bar (which already distinguishes
 * these) and with the Mark Departed / Mark Arrived button next
 * to it. Without this split, a just-released flight reads as
 * AIRBORNE while a "Mark Departed" button sits inches away.
 *
 * Wider status set (on_ground / delayed / diverted) lives in
 * M2-M-14b — handled there by extending FlightStatus on the
 * backend. The "OVERDUE" pill is rendered alongside AIRBORNE by
 * the board row, not by this component.
 */
export function StatusBadge({
  status,
  actualDepartureAt,
}: {
  status: FlightStatus;
  /** Present the pill as RELEASED (yellow) when the flight is
   *  released but hasn't actually departed yet. Callers that don't
   *  have this field (e.g. the older aircraft-detail panel) can
   *  omit it and get the legacy AIRBORNE label for any released
   *  row — safe fallback, since those surfaces don't render
   *  released-not-departed flights anyway. */
  actualDepartureAt?: string | null;
}) {
  const config =
    status === "released" && !actualDepartureAt
      ? RELEASED_ON_GROUND
      : STATUS_LABELS[status];
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

const RELEASED_ON_GROUND = {
  label: "Released",
  className: "bg-status-yellow/15 text-status-yellow",
};

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

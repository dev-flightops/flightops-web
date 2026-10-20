import { StatusMark, type StatusTone } from "@/components/ff/status-mark";
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
 *
 * ForeFlight's quiet status (#78): the label in its status colour behind
 * a small square marker — no tinted pill. The colour does the work; the
 * marker keeps it findable for a reader who cannot tell the hues apart.
 */
export function StatusBadge({
  status,
  actualDepartureAt,
}: {
  status: FlightStatus;
  /** Explicit `null` = "known to have no actual_departure_at yet";
   *  the pill renders RELEASED (yellow) instead of AIRBORNE. Omit
   *  the prop entirely (undefined) when the caller doesn't have
   *  the field on its row shape — the pill falls back to the
   *  legacy AIRBORNE label. `/history` (completed+cancelled) and
   *  `/eod` (scheduled-only) don't render released rows at all,
   *  so the fallback is invisible there in practice. */
  actualDepartureAt?: string | null;
}) {
  const config =
    status === "released" && actualDepartureAt === null
      ? RELEASED_ON_GROUND
      : STATUS_LABELS[status];
  return <StatusMark label={config.label} tone={config.tone} />;
}

const RELEASED_ON_GROUND: { label: string; tone: StatusTone } = {
  label: "Released",
  tone: "yellow",
};

/** Red pill rendered next to AIRBORNE when the flight is past
 *  scheduled_arrival_at + 30 min. Kept as its own component so the
 *  legacy two-pill layout (`AIRBORNE  OVERDUE`) is easy to compose. */
export function OverdueBadge() {
  return <StatusMark label="Overdue" tone="red" />;
}

const STATUS_LABELS: Record<FlightStatus, { label: string; tone: StatusTone }> = {
  scheduled: {
    label: "Planned",
    tone: "blue",
  },
  released: {
    label: "Airborne",
    tone: "green",
  },
  cancelled: {
    label: "Cancelled",
    tone: "muted",
  },
  completed: {
    label: "Landed",
    tone: "muted",
  },
};

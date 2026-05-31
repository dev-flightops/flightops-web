import { cn } from "@/lib/utils";

/**
 * Centered inline counter row directly under the greeting. Pixel-match for
 * the legacy `.status-strip` (centered flex, 2rem gap, tiny semibold copy).
 *
 * Legacy fields don't all map to data we have yet:
 *
 *   legacy        → our status today
 *   airborne      → 0 (no flight-following service yet — lands in M2)
 *   on ground     → today's scheduled + released count
 *   acft hold     → aircraft_total - aircraft_active
 *   unread alerts → no alerts service yet (legacy hides if 0; so do we)
 *
 * Disclosed honestly via the muted color on the "airborne" value so the
 * demo audience doesn't think they're looking at real airborne tracking.
 */

export interface StatusItem {
  value: number | string;
  label: string;
  /** Hex / tailwind color for the value. Falls back to muted-foreground. */
  color?: string;
  /** Render the value muted to signal "not yet implemented". */
  pending?: boolean;
}

export function StatusStrip({ items }: { items: StatusItem[] }) {
  if (items.length === 0) return null;

  return (
    <div className="mb-10 flex flex-wrap items-center justify-center gap-8 py-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-1.5 text-[0.7rem] font-semibold tracking-[0.03em] text-muted-foreground"
        >
          <span
            className={cn(
              "text-[0.8rem] font-bold tabular-nums",
              item.pending && "opacity-50",
            )}
            style={
              !item.pending && item.color ? { color: item.color } : undefined
            }
          >
            {item.value}
          </span>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

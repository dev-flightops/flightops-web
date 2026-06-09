import type { PositionResponse } from "@/lib/api/types";

/**
 * Top-of-map banner that warns when the visible fleet contains
 * any simulated (demo-data) position fixes.
 *
 * Verbatim copy + amber styling from the legacy
 * `templates/flight_following/board.html#sim-banner` so dispatchers
 * who've used the legacy in production recognize it immediately.
 *
 * Renders nothing when every position has a real-source feed (adsb,
 * gps, manual). The check is per-render — once the M3 ADS-B adapter
 * starts ingesting real fixes the banner disappears without code
 * changes.
 *
 * `pointer-events-none` so the banner doesn't intercept Leaflet
 * clicks at the top edge of the map.
 */
export function SimBanner({ positions }: { positions: PositionResponse[] }) {
  const hasSimulated = positions.some((p) => p.source === "simulated");
  if (!hasSimulated) return null;

  return (
    <div
      role="status"
      className="pointer-events-none absolute inset-x-0 top-0 z-[1000] border-b border-status-yellow bg-status-yellow/90 px-4 py-1 text-center text-[0.65rem] font-bold uppercase tracking-[0.15em] text-black"
    >
      Simulation mode — aircraft positions are simulated for demonstration
    </div>
  );
}

import type { FlightLeg } from "@/lib/api/types";

/**
 * A flight's block time in milliseconds, by legs (1124-11, 1124-24; Greg,
 * 26 Nov: one rule, as pay has it): each leg's marks, a leg without both
 * counting its scheduled block. A single leg is its actual departure to
 * arrival. Never first takeoff to last landing on a flight with stops: End
 * of Day read PGR800 as 2.4 h, the ground time at its stops included, where
 * the roster and pay read 1.86 h. Null until it has left and landed.
 */
export function blockMs(flight: {
  actual_departure_at?: string | null;
  actual_arrival_at?: string | null;
  legs?: FlightLeg[];
}): number | null {
  if (!flight.actual_departure_at || !flight.actual_arrival_at) return null;
  const legs = flight.legs ?? [];
  if (legs.length > 1) {
    let total = 0;
    for (const leg of legs) {
      const off = leg.actual_departure_at ? Date.parse(leg.actual_departure_at) : NaN;
      const on = leg.actual_arrival_at ? Date.parse(leg.actual_arrival_at) : NaN;
      total +=
        Number.isFinite(off) && Number.isFinite(on)
          ? on - off
          : Date.parse(leg.scheduled_arrival_at) - Date.parse(leg.scheduled_departure_at);
    }
    return Math.max(total, 0);
  }
  const off = Date.parse(flight.actual_departure_at);
  const on = Date.parse(flight.actual_arrival_at);
  return Number.isFinite(off) && Number.isFinite(on) && on >= off ? on - off : null;
}

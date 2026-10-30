import type { FlightSearchResult } from "@/lib/api/flight-search";
import { getFlightLoad } from "@/lib/api/manifest";

/** What each flight can still carry (#153): ops' load for it, the useful
 *  load less crew, fuel and the payload already on it. The client, 29 Oct:
 *  "it would be better for the reservations folks to see max payload
 *  instead of overloading the plane and waiting for the pilot to kick the
 *  weight back." Null when the aircraft has no useful load on file or the
 *  load can't be read: the search still answers. */
export async function withPayloadLeft(items: FlightSearchResult[]): Promise<FlightSearchResult[]> {
  return Promise.all(
    items.map(async (flight) => {
      try {
        const left = (await getFlightLoad(flight.flight_id)).load?.remaining_lbs;
        return { ...flight, payload_left_lbs: left == null ? null : Math.floor(Number(left)) };
      } catch {
        return { ...flight, payload_left_lbs: null };
      }
    }),
  );
}

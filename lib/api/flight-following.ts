/**
 * Typed wrappers around the flight-following-service endpoints
 * (M2-M-11b / M2-M-12b). Server-side only — `apiFetch` reads the
 * Auth.js session for the JWT, so this module imports `auth()` and
 * can't run in a client component.
 *
 * For client-side polling, route through a server action that calls
 * these wrappers, or use `router.refresh()` to re-trigger the
 * server-component fetch (M2-G-8 uses the latter — keeps the JWT
 * server-side, costs one round-trip per refresh).
 */

import { apiFetch } from "./client";
import type { PositionListResponse } from "./types";

/** Fleet snapshot: latest position per aircraft that has ever had a
 *  fix. Returns an empty list when no positions have been ingested. */
export async function getLatestPositions(): Promise<PositionListResponse> {
  return apiFetch<PositionListResponse>(
    `/flight-following/positions/latest`,
  );
}

/** All positions for one flight, in chronological order. Returns
 *  an empty `items` array when the flight has no positions yet (vs
 *  404 when the flight itself doesn't exist in the caller's tenant). */
export async function getFlightTrack(
  flightId: string,
): Promise<PositionListResponse> {
  return apiFetch<PositionListResponse>(
    `/flight-following/flights/${flightId}/track`,
  );
}

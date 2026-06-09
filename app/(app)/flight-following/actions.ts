"use server";

import { ApiError } from "@/lib/api/client";
import { getFlightTrack } from "@/lib/api/flight-following";
import type { PositionResponse } from "@/lib/api/types";

export type FlightTrackActionResult =
  | { ok: true; positions: PositionResponse[] }
  | { ok: false; error: string };

/**
 * Fetch the time-ordered position track for one flight. Wraps the
 * server-side `getFlightTrack` so the client-side FleetMap can call
 * it via a server action — keeps the JWT server-side, no client
 * API client needed.
 *
 * Errors are mapped to short user-facing strings; the map renders
 * them as a toast / inline message rather than failing silently.
 */
export async function getFlightTrackAction(
  flightId: string,
): Promise<FlightTrackActionResult> {
  try {
    const response = await getFlightTrack(flightId);
    return { ok: true, positions: response.items };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return {
          ok: false,
          error: "This flight no longer exists.",
        };
      }
      if (err.status === 401) {
        return {
          ok: false,
          error: "Your session expired — please sign in again.",
        };
      }
      return {
        ok: false,
        error: `Track unavailable (HTTP ${err.status}).`,
      };
    }
    return { ok: false, error: "Track unavailable. Please try again." };
  }
}

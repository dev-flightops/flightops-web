/**
 * Typed wrapper around the maintenance-service airworthiness endpoint
 * (M2-M-8). Reads MEL items + open squawks for the aircraft and returns
 * a structured verdict + reasons.
 *
 * Backend classifies in one round-trip (one DB hit per table) — UI just
 * renders blocking_issues + advisory_issues based on the `kind`
 * discriminator. See lib/api/types.ts for the response shape.
 */

import { apiFetch } from "./client";
import type { AirworthinessResponse } from "./types";

export async function getAirworthiness(
  aircraftId: string,
): Promise<AirworthinessResponse> {
  return apiFetch<AirworthinessResponse>(
    `/maintenance/aircraft/${aircraftId}/airworthiness`,
  );
}

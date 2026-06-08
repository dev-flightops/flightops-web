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
import type {
  AirworthinessResponse,
  MelItemCloseRequest,
  MelItemCreateRequest,
  MelItemResponse,
  SquawkCreateRequest,
  SquawkResolveRequest,
  SquawkResponse,
} from "./types";

export async function getAirworthiness(
  aircraftId: string,
): Promise<AirworthinessResponse> {
  return apiFetch<AirworthinessResponse>(
    `/maintenance/aircraft/${aircraftId}/airworthiness`,
  );
}

export async function createMelItem(
  payload: MelItemCreateRequest,
): Promise<MelItemResponse> {
  return apiFetch<MelItemResponse>(`/maintenance/mel-items`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function createSquawk(
  payload: SquawkCreateRequest,
): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(`/maintenance/squawks`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function closeMelItem(
  melItemId: string,
  payload: MelItemCloseRequest,
): Promise<MelItemResponse> {
  return apiFetch<MelItemResponse>(
    `/maintenance/mel-items/${melItemId}/close`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function resolveSquawk(
  squawkId: string,
  payload: SquawkResolveRequest,
): Promise<SquawkResponse> {
  return apiFetch<SquawkResponse>(
    `/maintenance/squawks/${squawkId}/resolve`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

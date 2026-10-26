"use server";

import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { getFlightOpening, textOpening, type Opening } from "@/lib/api/open-seats";

/** The flight's opening as it stands (null: none), or why it couldn't be
 *  had, in which case `opening` is left out and the page keeps its own. */
export type OpenSeatsState = { opening?: Opening | null; error?: string };

const _id = z.string().uuid();

function _failed(err: unknown): OpenSeatsState {
  if (err instanceof ApiError) {
    if (err.status === 401) return { error: "Your session expired. Sign in again, then retry." };
    if (err.status === 403) return { error: "Your account can't send these texts." };
    if (err.status === 409) {
      return { error: "Set up the company's text-message account first, in Settings → Integrations." };
    }
    return { error: `The texts weren't sent (HTTP ${err.status}).` };
  }
  return { error: "Could not reach the ops service. Try again in a moment." };
}

/** The seats a no-show opened on this flight (#120), fetched again. */
export async function refreshOpeningAction(flightId: string): Promise<OpenSeatsState> {
  if (!_id.safeParse(flightId).success) return {};
  try {
    return { opening: await getFlightOpening(flightId) };
  } catch (err) {
    return _failed(err);
  }
}

/** Text the passengers waiting who haven't been told, and send the texts
 *  kept while there was no account. */
export async function textOpeningAction(flightId: string): Promise<OpenSeatsState> {
  if (!_id.safeParse(flightId).success) return {};
  try {
    return { opening: await textOpening(flightId) };
  } catch (err) {
    return _failed(err);
  }
}

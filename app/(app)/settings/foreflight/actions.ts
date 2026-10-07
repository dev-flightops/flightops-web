"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  checkForeFlight,
  disconnectForeFlight,
  fetchFromForeFlight,
  sendToForeFlight,
  updateForeFlight,
  type ForeFlightCheck,
  type ForeFlightFetch,
  type ForeFlightSend,
} from "@/lib/api/integrations";

/**
 * /settings/foreflight server actions (#54, #55). Each returns an outcome
 * for the card to show rather than throwing to the error page.
 */

export type Outcome<T = null> = { ok: true; value: T } | { ok: false; error: string };

const PATH = "/settings/foreflight";

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return {
        ok: false,
        error: "Only the Director of Operations or an Exec Admin can change the ForeFlight connection.",
      };
    }
    if (err.message.includes("foreflight_not_connected")) {
      return { ok: false, error: "Save the API key first." };
    }
    if (err.status === 422) {
      return { ok: false, error: "That doesn't look like a ForeFlight API key." };
    }
  }
  return { ok: false, error: "That didn't go through. Try again in a moment." };
}

/** Save a new key, then check it at once so the page can say whose account it is. */
export async function saveForeFlightKeyAction(apiKey: string): Promise<Outcome<ForeFlightCheck>> {
  const key = apiKey.trim();
  if (key.length < 8 || key.length > 200) {
    return { ok: false, error: "That doesn't look like a ForeFlight API key." };
  }
  try {
    await updateForeFlight({ api_key: key });
    const check = await checkForeFlight();
    revalidatePath(PATH);
    return { ok: true, value: check };
  } catch (err) {
    return failure(err);
  }
}

export async function setForeFlightSendingAction(on: boolean): Promise<Outcome> {
  try {
    await updateForeFlight({ send_flights: on });
    revalidatePath(PATH);
    return { ok: true, value: null };
  } catch (err) {
    return failure(err);
  }
}

/** Bring pilots' plans back every five minutes (#55), or stop. */
export async function setForeFlightPlansAction(on: boolean): Promise<Outcome> {
  try {
    await updateForeFlight({ bring_plans: on });
    revalidatePath(PATH);
    return { ok: true, value: null };
  } catch (err) {
    return failure(err);
  }
}

export async function fetchFromForeFlightAction(): Promise<Outcome<ForeFlightFetch>> {
  try {
    const fetched = await fetchFromForeFlight();
    revalidatePath(PATH);
    return { ok: true, value: fetched };
  } catch (err) {
    return failure(err);
  }
}

export async function checkForeFlightAction(): Promise<Outcome<ForeFlightCheck>> {
  try {
    const check = await checkForeFlight();
    revalidatePath(PATH);
    return { ok: true, value: check };
  } catch (err) {
    return failure(err);
  }
}

export async function sendToForeFlightAction(): Promise<Outcome<ForeFlightSend>> {
  try {
    const sent = await sendToForeFlight();
    revalidatePath(PATH);
    return { ok: true, value: sent };
  } catch (err) {
    return failure(err);
  }
}

export async function disconnectForeFlightAction(): Promise<Outcome> {
  try {
    await disconnectForeFlight();
    revalidatePath(PATH);
    return { ok: true, value: null };
  } catch (err) {
    return failure(err);
  }
}

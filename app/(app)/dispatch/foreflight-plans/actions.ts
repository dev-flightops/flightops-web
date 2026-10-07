"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { assignPlan, ignorePlan } from "@/lib/api/integrations";

/**
 * /dispatch/foreflight-plans server actions (#55): put a waiting plan on
 * a leg, or set it aside. Each returns an outcome for the row to show.
 */

export type PlanOutcome = { ok: true } | { ok: false; error: string };

const PATH = "/dispatch/foreflight-plans";

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return { ok: false, error: "Only a dispatcher or an Exec Admin places ForeFlight plans." };
    }
    if (err.message.includes("leg_not_on_flight")) {
      return { ok: false, error: "That leg isn't on the flight any more. Refresh and choose again." };
    }
    if (err.status === 404) {
      return { ok: false, error: "That plan or flight is gone. Refresh the page." };
    }
  }
  return { ok: false, error: "That didn't go through. Try again in a moment." };
}

export async function assignPlanAction(
  planId: string,
  flightId: string,
  legSequence: number,
): Promise<PlanOutcome> {
  try {
    await assignPlan(planId, flightId, legSequence);
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

export async function ignorePlanAction(planId: string): Promise<PlanOutcome> {
  try {
    await ignorePlan(planId);
    revalidatePath(PATH);
    return { ok: true };
  } catch (err) {
    return failure(err);
  }
}

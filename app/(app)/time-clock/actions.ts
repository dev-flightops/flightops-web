"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { amendDutyPeriod } from "@/lib/api/ops";

export interface AmendState {
  status: "idle" | "ok" | "error";
  message?: string;
}

/**
 * Why an amendment was refused, in words.
 *
 * The server answers with a slug so it can be acted on
 * programmatically; a pilot needs the sentence. Anything unrecognised
 * keeps the slug rather than being smoothed into a guess.
 */
const REFUSALS: Record<string, string> = {
  time_in_the_future:
    "Duty is a record of what happened — the time cannot be in the future.",
  clock_out_before_clock_in: "Duty out has to be after duty in.",
  overlaps_another_period:
    "That would overlap another duty period. Two periods covering the same hour would double-count against your duty limits.",
  outside_amendment_window:
    "That period is more than 30 days old. Ask your chief pilot to correct it.",
  nothing_to_amend: "Nothing was changed.",
  duty_period_not_found: "That duty period could not be found.",
};

export async function amendDutyAction(
  periodId: string,
  clockInAt: string | null,
  clockOutAt: string | null,
  reason: string,
): Promise<AmendState> {
  if (!reason.trim()) {
    return { status: "error", message: "Say why it is being corrected." };
  }
  if (!clockInAt && !clockOutAt) {
    return { status: "error", message: "Change at least one time." };
  }

  try {
    await amendDutyPeriod(periodId, {
      ...(clockInAt ? { clock_in_at: clockInAt } : {}),
      ...(clockOutAt ? { clock_out_at: clockOutAt } : {}),
      reason: reason.trim(),
    });
  } catch (err) {
    if (err instanceof ApiError) {
      for (const [slug, sentence] of Object.entries(REFUSALS)) {
        if (err.message.includes(slug)) {
          return { status: "error", message: sentence };
        }
      }
      return { status: "error", message: `The correction was refused (${err.status}).` };
    }
    return { status: "error", message: "Could not reach the duty service." };
  }

  revalidatePath("/time-clock");
  revalidatePath("/flight-crew");
  return { status: "ok", message: "Corrected." };
}

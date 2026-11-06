"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import { moveOnMxClock, stampMxMilestone, startMxClock } from "@/lib/api/maintenance";
import { refusalText } from "@/lib/api/validation-errors";

/** The maintenance clock from the web (#172). */

export type ClockResult = { ok: true } | { ok: false; message: string };

function refusal(err: unknown, what: string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return "Your session expired — please sign in again.";
    if (err.status === 403) {
      return "Only maintenance, the Director of Maintenance or an Exec Admin can run the clock.";
    }
    if (err.status === 404) return "That isn't on file any more — refresh the page.";
    return refusalText(err) ?? `Couldn't ${what} (HTTP ${err.status}). Try again in a moment.`;
  }
  return `Couldn't ${what}. Try again in a moment.`;
}

function done(): ClockResult {
  revalidatePath("/maintenance/mx-clock");
  revalidatePath("/maintenance/availability");
  return { ok: true };
}

export async function startClockAction(input: {
  aircraftId: string;
  workOrderId: string;
  notes: string;
}): Promise<ClockResult> {
  if (!input.aircraftId) return { ok: false, message: "Pick the aircraft." };
  try {
    await startMxClock({
      aircraft_id: input.aircraftId,
      work_order_id: input.workOrderId || null,
      notes: input.notes.trim() || null,
    });
  } catch (err) {
    return { ok: false, message: refusal(err, "start the clock") };
  }
  return done();
}

export async function stampMilestoneAction(clockId: string, milestone: string): Promise<ClockResult> {
  try {
    await stampMxMilestone(clockId, milestone);
  } catch (err) {
    return { ok: false, message: refusal(err, "record that") };
  }
  return done();
}

export async function moveOnClockAction(clockId: string, move: "join" | "leave" | "complete"): Promise<ClockResult> {
  try {
    await moveOnMxClock(clockId, move);
  } catch (err) {
    return { ok: false, message: refusal(err, "do that") };
  }
  return done();
}

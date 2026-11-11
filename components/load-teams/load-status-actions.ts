"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError } from "@/lib/api/client";
import { acknowledgeLoad, completeLoad, reopenLoad, startLoad } from "@/lib/api/ground";

/**
 * A load team acknowledges a flight's load, starts loading it (LOG-43),
 * marks it complete, or takes "complete" back (#134). Every page that shows where a load stands is
 * revalidated: the ramper's list, Ramp Ops, the dispatch packet and the
 * pilot's flight.
 */

export type LoadActionResult = { ok: true } | { ok: false; message: string };

const Id = z.string().uuid();

function revalidate() {
  revalidatePath("/ramper");
  revalidatePath("/ramp-ops");
  revalidatePath("/dispatch");
  revalidatePath("/flight-crew");
}

function detail(err: ApiError): string | null {
  try {
    const parsed = JSON.parse(err.message) as { detail?: unknown };
    return typeof parsed.detail === "string" ? parsed.detail : null;
  } catch {
    return null;
  }
}

function refused(err: unknown): LoadActionResult {
  if (!(err instanceof ApiError)) return { ok: false, message: "Couldn't reach the ramp service. Try again." };
  if (err.status === 401) return { ok: false, message: "Your session expired — sign in again." };
  if (err.status === 403) return { ok: false, message: "Only the ramp, dispatch and ops management can record a load." };
  if (err.status === 404) return { ok: false, message: "That load isn't on file any more — refresh the page." };
  if (err.status === 409) {
    return {
      ok: false,
      message:
        detail(err) === "flight_closed"
          ? "The flight is already closed."
          : "The flight moved to another team or came off its team — refresh the page.",
    };
  }
  return { ok: false, message: `Couldn't record it (HTTP ${err.status}). Try again.` };
}

async function run(assignmentId: string, act: (id: string) => Promise<unknown>): Promise<LoadActionResult> {
  const id = Id.safeParse(assignmentId);
  if (!id.success) return { ok: false, message: "That load isn't valid." };
  try {
    await act(id.data);
  } catch (err) {
    return refused(err);
  }
  revalidate();
  return { ok: true };
}

export async function acknowledgeLoadAction(assignmentId: string): Promise<LoadActionResult> {
  return run(assignmentId, acknowledgeLoad);
}

export async function startLoadAction(assignmentId: string): Promise<LoadActionResult> {
  return run(assignmentId, startLoad);
}

export async function completeLoadAction(assignmentId: string): Promise<LoadActionResult> {
  return run(assignmentId, completeLoad);
}

export async function reopenLoadAction(assignmentId: string): Promise<LoadActionResult> {
  return run(assignmentId, reopenLoad);
}

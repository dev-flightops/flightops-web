"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  closeMelItem,
  createMelItem,
  createSquawk,
  resolveSquawk,
} from "@/lib/api/maintenance";
import type {
  MelItemCloseRequest,
  MelItemCreateRequest,
  SquawkCreateRequest,
  SquawkResolveRequest,
} from "@/lib/api/types";

export type MelDeferralActionResult =
  | { ok: true; mel_item_id: string }
  | { ok: false; error: string };

export type SquawkActionResult =
  | { ok: true; squawk_id: string }
  | { ok: false; error: string };

export type CloseMelActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type ResolveSquawkActionResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Create a MEL deferral.
 *
 * The dialog component handles client-side validation via zod; this action
 * is the network round-trip + cache invalidation. We revalidate /dispatch
 * (and /dispatch/[flightId]) so the MaintenancePanel re-fetches the
 * airworthiness verdict and the new MEL shows up in the right list.
 */
export async function createMelDeferralAction(
  payload: MelItemCreateRequest,
): Promise<MelDeferralActionResult> {
  try {
    const created = await createMelItem(payload);

    revalidatePath(`/dispatch`);
    // /dispatch/[flightId] is a separate route segment in the App Router
    // tree; revalidate the layout so any open flight detail page also
    // refetches.
    revalidatePath(`/dispatch`, "layout");

    return { ok: true, mel_item_id: created.id };
  } catch (err) {
    if (err instanceof ApiError) {
      // 400 = bad due_at (before deferred_at). 404 = aircraft wasn't found
      // in the caller's tenant. 422 = pydantic validation (shouldn't reach
      // here since the dialog already validates).
      if (err.status === 400) {
        return {
          ok: false,
          error: "Due date must be after the deferred-at date.",
        };
      }
      if (err.status === 404) {
        return { ok: false, error: "Aircraft not found." };
      }
      if (err.status === 422) {
        // pydantic returns a structured body; surfacing the first error's
        // location + message keeps the dialog actionable instead of just
        // showing "422".
        return {
          ok: false,
          error: extractFirst422Message(err.message),
        };
      }
      return { ok: false, error: `Save failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Save failed. Please try again." };
  }
}

/**
 * File a new squawk against an aircraft.
 *
 * Same shape as createMelDeferralAction — the dialog handles validation;
 * this action is the network round-trip + cache invalidation. The reporter
 * (reported_by_user_id) is inferred from the JWT on the backend, so the
 * client only sends aircraft_id + reported_at + title + description + severity.
 */
export async function createSquawkAction(
  payload: SquawkCreateRequest,
): Promise<SquawkActionResult> {
  try {
    const created = await createSquawk(payload);

    revalidatePath(`/dispatch`);
    revalidatePath(`/dispatch`, "layout");

    return { ok: true, squawk_id: created.id };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return { ok: false, error: "Aircraft not found." };
      }
      if (err.status === 422) {
        return { ok: false, error: extractFirst422Message(err.message) };
      }
      return { ok: false, error: `Save failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Save failed. Please try again." };
  }
}

/**
 * Mark an open MEL item as closed (mechanic repaired the deferred
 * equipment). Optional notes are appended to the existing notes
 * server-side. After success, the maintenance panel re-fetches and
 * the item disappears from the verdict (no longer "open").
 */
export async function closeMelDeferralAction(
  melItemId: string,
  payload: MelItemCloseRequest,
): Promise<CloseMelActionResult> {
  try {
    await closeMelItem(melItemId, payload);

    revalidatePath(`/dispatch`);
    revalidatePath(`/dispatch`, "layout");

    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return { ok: false, error: "MEL item not found." };
      }
      if (err.status === 409) {
        return {
          ok: false,
          error: "This MEL item is already closed.",
        };
      }
      if (err.status === 422) {
        return { ok: false, error: extractFirst422Message(err.message) };
      }
      return { ok: false, error: `Close failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Close failed. Please try again." };
  }
}

/**
 * Mark a squawk as resolved. resolution_notes is required (backend
 * enforces min_length=1). After success the maintenance panel
 * re-fetches and the squawk drops from the verdict.
 */
export async function resolveSquawkAction(
  squawkId: string,
  payload: SquawkResolveRequest,
): Promise<ResolveSquawkActionResult> {
  try {
    await resolveSquawk(squawkId, payload);

    revalidatePath(`/dispatch`);
    revalidatePath(`/dispatch`, "layout");

    return { ok: true };
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 404) {
        return { ok: false, error: "Squawk not found." };
      }
      if (err.status === 409) {
        return {
          ok: false,
          error: "This squawk is already resolved.",
        };
      }
      if (err.status === 422) {
        return { ok: false, error: extractFirst422Message(err.message) };
      }
      return { ok: false, error: `Resolve failed (HTTP ${err.status}).` };
    }
    return { ok: false, error: "Resolve failed. Please try again." };
  }
}

function extractFirst422Message(body: string): string {
  try {
    const parsed = JSON.parse(body) as {
      detail?: Array<{ loc?: unknown[]; msg?: string }>;
    };
    const first = parsed.detail?.[0];
    if (first?.msg) {
      const field = Array.isArray(first.loc)
        ? first.loc.filter((p) => p !== "body").join(".")
        : "";
      return field ? `${field}: ${first.msg}` : first.msg;
    }
  } catch {
    /* fall through */
  }
  return "Validation failed. Check the fields and try again.";
}

"use server";

import { revalidatePath } from "next/cache";

import { ApiError } from "@/lib/api/client";
import {
  createDocumentRequirement,
  deactivateDocumentRequirement,
  updateDocumentRequirement,
  type RequirementCreatePayload,
  type RequirementUpdatePayload,
} from "@/lib/api/employee-documents";
import { isRole } from "@/lib/roles";

export interface RequirementResult {
  ok: boolean;
  error?: string;
}

const MAX_REMINDER_DAYS = 3650;

/**
 * Validated here so a message names the field. The service has the
 * CHECK constraints and the final say; this is so an operator is not
 * shown a database error.
 */
function validate(
  patch: RequirementCreatePayload | RequirementUpdatePayload,
): string | null {
  if ("name" in patch && patch.name !== undefined && !patch.name.trim()) {
    return "Give the requirement a name.";
  }
  if (patch.reminder_days !== undefined) {
    const d = patch.reminder_days;
    if (!Number.isInteger(d) || d < 0 || d > MAX_REMINDER_DAYS) {
      return "The reminder window has to be a whole number of days, 0 or more.";
    }
  }
  if (patch.applies_to_roles !== undefined) {
    // A role that does not exist would scope the requirement to
    // nobody, silently — the same class of bug lib/roles.ts exists to
    // stop in page gates.
    const unknown = patch.applies_to_roles.filter((r) => !isRole(r));
    if (unknown.length > 0) {
      return `Not a role we use: ${unknown.join(", ")}.`;
    }
  }
  return null;
}

export async function createRequirementAction(
  payload: RequirementCreatePayload,
): Promise<RequirementResult> {
  const invalid = validate(payload);
  if (invalid) return { ok: false, error: invalid };
  try {
    await createDocumentRequirement({
      ...payload,
      name: payload.name.trim(),
    });
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't create it.") };
  }
  revalidateAll();
  return { ok: true };
}

export async function updateRequirementAction(
  requirementId: string,
  patch: RequirementUpdatePayload,
): Promise<RequirementResult> {
  const invalid = validate(patch);
  if (invalid) return { ok: false, error: invalid };
  try {
    await updateDocumentRequirement(requirementId, patch);
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't save it.") };
  }
  revalidateAll();
  return { ok: true };
}

/**
 * Retire, not delete. The service deactivates rather than dropping the
 * row, so documents already filed against it stay readable — a
 * certificate somebody filed is a record even after the operator stops
 * requiring it.
 */
export async function retireRequirementAction(
  requirementId: string,
): Promise<RequirementResult> {
  try {
    await deactivateDocumentRequirement(requirementId);
  } catch (err) {
    return { ok: false, error: mapError(err, "Couldn't retire it.") };
  }
  revalidateAll();
  return { ok: true };
}

function revalidateAll() {
  revalidatePath("/settings/document-requirements");
  // Every employee's checklist is built from this list, and the tab's
  // outstanding badge with it.
  revalidatePath("/employees", "layout");
}

function mapError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    if (err.status === 403) {
      return "You need Exec Admin to change document requirements.";
    }
    if (err.status >= 400 && err.status < 500) {
      try {
        const detail = (JSON.parse(err.message) as { detail?: unknown })
          .detail;
        if (typeof detail === "string" && detail.trim()) return detail;
      } catch {
        // Not JSON; fall through rather than showing the raw body.
      }
    }
  }
  return fallback;
}
